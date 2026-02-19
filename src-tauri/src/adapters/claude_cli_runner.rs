use crate::domain::error::DomainError;
use crate::domain::models::{AgentStatus, StreamMessage};
use crate::domain::ports::{AgentRunner, ResumeConfig, SpawnConfig};
use crate::domain::session_manager::SessionManager;
use crate::domain::stream_parser;
use async_trait::async_trait;
use chrono::Utc;
use regex::Regex;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, LazyLock};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio::sync::RwLock;

/// Regex to find ISO 8601 timestamps in rate-limit error messages.
static ISO_TIMESTAMP_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})?").unwrap()
});

/// Returns true if the error text indicates a quota/rate-limit (not a transient overload).
fn is_quota_rate_limit(text: &str) -> bool {
    let lower = text.to_lowercase();
    lower.contains("usage limit")
        || lower.contains("rate_limit_error")
        || lower.contains("rate limit exceeded")
        || lower.contains("quota exceeded")
        || (lower.contains("429") && lower.contains("reset"))
}

/// Try to extract an ISO 8601 reset timestamp from an error message.
fn extract_reset_time(text: &str) -> Option<String> {
    ISO_TIMESTAMP_RE
        .captures(text)
        .map(|cap| cap[0].to_string())
}

/// Env var allowlist for spawned processes (P0 Security #3).
const ENV_ALLOWLIST: &[&str] = &[
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "TERM",
    "ANTHROPIC_API_KEY",
    "CLAUDE_CODE_API_KEY",
];

struct RunningProcess {
    abort_handle: tokio::task::JoinHandle<()>,
}

/// AgentRunner adapter that spawns Claude Code CLI processes.
pub struct ClaudeCliRunner {
    /// Reference back to SessionManager for callbacks.
    session_manager: Arc<SessionManager>,
    /// Tracks running processes for kill/kill_all.
    processes: RwLock<HashMap<String, Arc<Mutex<RunningProcess>>>>,
}

impl ClaudeCliRunner {
    pub fn new(session_manager: Arc<SessionManager>) -> Self {
        Self {
            session_manager,
            processes: RwLock::new(HashMap::new()),
        }
    }

    fn build_env() -> Vec<(String, String)> {
        ENV_ALLOWLIST
            .iter()
            .filter_map(|key| std::env::var(key).ok().map(|val| (key.to_string(), val)))
            .collect()
    }

    /// Spawn the stdout/stderr reader task. Returns a JoinHandle to abort on kill.
    fn spawn_reader_task(
        sm: Arc<SessionManager>,
        sid: String,
        stdout: tokio::process::ChildStdout,
        stderr: tokio::process::ChildStderr,
        mut child: tokio::process::Child,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            // Mark running via domain callback
            sm.on_agent_running(&sid).await;

            let mut stdout_reader = BufReader::new(stdout).lines();
            let mut final_status = AgentStatus::Completed;

            while let Ok(Some(line)) = stdout_reader.next_line().await {
                if let Some(msg) = stream_parser::parse_stream_line(&line) {
                    let redacted = stream_parser::redact_secrets(&line);
                    let msg_type = msg.message_type().to_string();

                    if let StreamMessage::Result(ref r) = msg {
                        if r.subtype.as_deref() == Some("error") {
                            final_status = AgentStatus::Error;
                            // Detect quota rate-limits and emit a dedicated event
                            if let Some(result_text) =
                                r.extra.get("result").and_then(|v| v.as_str())
                            {
                                if is_quota_rate_limit(result_text) {
                                    let reset_at = extract_reset_time(result_text);
                                    sm.on_rate_limited(
                                        &sid,
                                        reset_at,
                                        result_text.to_string(),
                                    )
                                    .await;
                                }
                            }
                        }
                        // Extract authoritative cost from the result message.
                        // Claude Code reports cost_usd regardless of success/error.
                        let cost_usd = r.extra.get("cost_usd")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0);
                        if cost_usd > 0.0 {
                            sm.on_agent_cost(&sid, cost_usd).await;
                        }
                    }

                    // Extract token usage
                    if let StreamMessage::Assistant(ref a) = msg {
                        if let Some(message) = &a.message {
                            if let Some(usage) = message.get("usage") {
                                let input = usage
                                    .get("input_tokens")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                let output = usage
                                    .get("output_tokens")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                if input > 0 || output > 0 {
                                    sm.on_agent_usage(&sid, input, output).await;
                                }
                            }
                        }
                    }

                    sm.on_agent_message(&sid, &msg_type, &redacted, &Utc::now().to_rfc3339())
                        .await;
                }
            }

            // Read remaining stderr
            let mut stderr_reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                let redacted = stream_parser::redact_secrets(&line);
                sm.on_agent_message(&sid, "stderr", &redacted, &Utc::now().to_rfc3339())
                    .await;
            }

            let _ = child.wait().await;

            // Signal domain that agent is done
            sm.on_agent_finished(&sid, final_status).await;
        })
    }

    /// Build and spawn a Claude CLI Command.
    fn build_command(args: &[&str], project_dir: &str) -> Result<tokio::process::Child, DomainError> {
        let env_vars = Self::build_env();

        let mut cmd = Command::new("claude");
        cmd.args(args);
        cmd.current_dir(project_dir);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.stdin(Stdio::null());
        cmd.env_clear();
        for (key, value) in &env_vars {
            cmd.env(key, value);
        }

        cmd.spawn().map_err(|e| DomainError::Process(e.to_string()))
    }
}

#[async_trait]
impl AgentRunner for ClaudeCliRunner {
    async fn spawn(&self, config: SpawnConfig) -> Result<(), DomainError> {
        let mut child = Self::build_command(
            &[
                "--print",
                "--output-format", "stream-json",
                "--verbose",
                "--agent", &config.agent_name,
                "--session-id", &config.session_id,
                "--model", &config.model,
                &config.prompt,
            ],
            &config.project_dir,
        )?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| DomainError::Process("No stdout".into()))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| DomainError::Process("No stderr".into()))?;

        let handle = Self::spawn_reader_task(
            Arc::clone(&self.session_manager),
            config.session_id.clone(),
            stdout,
            stderr,
            child,
        );

        self.processes.write().await.insert(
            config.session_id,
            Arc::new(Mutex::new(RunningProcess {
                abort_handle: handle,
            })),
        );

        Ok(())
    }

    async fn resume(&self, config: ResumeConfig) -> Result<(), DomainError> {
        let mut child = Self::build_command(
            &[
                "--print",
                "--output-format", "stream-json",
                "--verbose",
                "--resume", &config.session_id,
                &config.prompt,
            ],
            &config.project_dir,
        )?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| DomainError::Process("No stdout".into()))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| DomainError::Process("No stderr".into()))?;

        let handle = Self::spawn_reader_task(
            Arc::clone(&self.session_manager),
            config.session_id.clone(),
            stdout,
            stderr,
            child,
        );

        self.processes.write().await.insert(
            config.session_id,
            Arc::new(Mutex::new(RunningProcess {
                abort_handle: handle,
            })),
        );

        Ok(())
    }

    async fn kill(&self, session_id: &str) -> Result<(), DomainError> {
        let process = self
            .processes
            .write()
            .await
            .remove(session_id)
            .ok_or_else(|| DomainError::SessionNotFound(session_id.to_string()))?;

        let running = process.lock().await;
        running.abort_handle.abort();
        Ok(())
    }

    async fn kill_all(&self) {
        let mut processes = self.processes.write().await;
        for (_sid, process) in processes.drain() {
            let running = process.lock().await;
            running.abort_handle.abort();
        }
    }
}
