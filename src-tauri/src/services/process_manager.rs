use crate::error::AppError;
use crate::models::agent::AgentStatus;
use crate::models::message::StreamMessage;
use crate::models::session::AgentSession;
use crate::services::log_store::LogStore;
use crate::services::stream_parser;
use chrono::Utc;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

/// Env var allowlist for spawned processes (P0 Security #3).
/// Includes system vars needed for Claude Code credential resolution and
/// basic process operation, plus API key vars.
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

#[derive(Clone, serde::Serialize)]
pub struct AgentStatusEvent {
    pub session_id: String,
    pub agent_name: String,
    pub status: AgentStatus,
    pub model: String,
    pub prompt: String,
    pub ended_at: Option<String>,
}

#[derive(Clone, serde::Serialize)]
pub struct AgentMessageEvent {
    pub session_id: String,
    pub message_type: String,
    pub content: String,
    pub timestamp: String,
}

#[derive(Clone, serde::Serialize)]
pub struct AgentUsageEvent {
    pub session_id: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
}

struct RunningProcess {
    session: AgentSession,
    abort_handle: tokio::task::JoinHandle<()>,
}

type SessionMap = Arc<RwLock<HashMap<String, AgentSession>>>;

pub struct ProcessManager {
    processes: RwLock<HashMap<String, Arc<Mutex<RunningProcess>>>>,
    sessions: SessionMap,
    project_dir: RwLock<Option<String>>,
    log_store: std::sync::OnceLock<Arc<LogStore>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: RwLock::new(HashMap::new()),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            project_dir: RwLock::new(None),
            log_store: std::sync::OnceLock::new(),
        }
    }

    /// Attach a log store for persisting log entries to SQLite. Called once during init.
    pub fn set_log_store(&self, store: Arc<LogStore>) {
        let _ = self.log_store.set(store);
    }

    pub async fn set_project_dir(&self, path: String) {
        *self.project_dir.write().await = Some(path);
    }

    pub async fn get_project_dir(&self) -> Option<String> {
        self.project_dir.read().await.clone()
    }

    fn build_env() -> Vec<(String, String)> {
        ENV_ALLOWLIST
            .iter()
            .filter_map(|key| std::env::var(key).ok().map(|val| (key.to_string(), val)))
            .collect()
    }

    /// Spawn a stdout/stderr reader task that parses stream-json and emits events.
    fn spawn_reader_task(
        app: AppHandle,
        sessions: SessionMap,
        log_store: Option<Arc<LogStore>>,
        sid: String,
        aname: String,
        amodel: String,
        aprompt: String,
        stdout: tokio::process::ChildStdout,
        stderr: tokio::process::ChildStderr,
        mut child: tokio::process::Child,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            // Mark running
            let _ = app.emit(
                "agent:status-changed",
                AgentStatusEvent {
                    session_id: sid.clone(),
                    agent_name: aname.clone(),
                    status: AgentStatus::Running,
                    model: amodel.clone(),
                    prompt: aprompt.clone(),
                    ended_at: None,
                },
            );
            if let Some(s) = sessions.write().await.get_mut(&sid) {
                s.status = AgentStatus::Running;
            }

            let mut stdout_reader = BufReader::new(stdout).lines();
            let mut final_status = AgentStatus::Completed;

            while let Ok(Some(line)) = stdout_reader.next_line().await {
                if let Some(msg) = stream_parser::parse_stream_line(&line) {
                    // Store the raw (redacted) line — the TS parser works on raw JSON
                    let redacted = stream_parser::redact_secrets(&line);
                    let msg_type = msg.message_type().to_string();

                    if let StreamMessage::Result(ref r) = msg {
                        if r.subtype.as_deref() == Some("error") {
                            final_status = AgentStatus::Error;
                        }
                    }

                    // Extract token usage and emit usage event
                    if let StreamMessage::Assistant(ref a) = msg {
                        if let Some(message) = &a.message {
                            if let Some(usage) = message.get("usage") {
                                let mut guard = sessions.write().await;
                                if let Some(s) = guard.get_mut(&sid) {
                                    if let Some(v) = usage.get("input_tokens").and_then(|v| v.as_u64()) {
                                        s.input_tokens += v;
                                    }
                                    if let Some(v) = usage.get("output_tokens").and_then(|v| v.as_u64()) {
                                        s.output_tokens += v;
                                    }
                                    let _ = app.emit(
                                        "agent:usage-update",
                                        AgentUsageEvent {
                                            session_id: sid.clone(),
                                            input_tokens: s.input_tokens,
                                            output_tokens: s.output_tokens,
                                        },
                                    );
                                }
                            }
                        }
                    }

                    let event = AgentMessageEvent {
                        session_id: sid.clone(),
                        message_type: msg_type,
                        content: redacted,
                        timestamp: Utc::now().to_rfc3339(),
                    };

                    // Emit to frontend
                    let _ = app.emit("agent:message", event.clone());

                    // Persist to SQLite
                    if let Some(ref store) = log_store {
                        store.append(event).await;
                    }
                }
            }

            // Read remaining stderr
            let mut stderr_reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                let redacted = stream_parser::redact_secrets(&line);
                let event = AgentMessageEvent {
                    session_id: sid.clone(),
                    message_type: "stderr".to_string(),
                    content: redacted,
                    timestamp: Utc::now().to_rfc3339(),
                };
                let _ = app.emit("agent:message", event.clone());
                if let Some(ref store) = log_store {
                    store.append(event).await;
                }
            }

            let _ = child.wait().await;

            // Flush remaining logs for this session
            if let Some(ref store) = log_store {
                store.flush().await;
            }

            // Final status update
            let ended_at = Utc::now().to_rfc3339();
            if let Some(s) = sessions.write().await.get_mut(&sid) {
                s.status = final_status.clone();
                s.ended_at = Some(ended_at.clone());
            }

            let _ = app.emit(
                "agent:status-changed",
                AgentStatusEvent {
                    session_id: sid,
                    agent_name: aname,
                    status: final_status,
                    model: amodel,
                    prompt: aprompt,
                    ended_at: Some(ended_at),
                },
            );
        })
    }

    /// Start a new agent session.
    /// P0 Security #1: Uses Command::new with args array.
    /// P0 Security #3: Only passes allowlisted env vars.
    pub async fn start_agent(
        &self,
        app: AppHandle,
        agent_name: String,
        model: String,
        prompt: String,
    ) -> Result<String, AppError> {
        let project_dir = self
            .project_dir
            .read()
            .await
            .clone()
            .unwrap_or_else(|| ".".to_string());

        let session_id = Uuid::new_v4().to_string();

        let session = AgentSession {
            id: session_id.clone(),
            agent_name: agent_name.clone(),
            model: model.clone(),
            status: AgentStatus::Starting,
            prompt: prompt.clone(),
            started_at: Utc::now().to_rfc3339(),
            ended_at: None,
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0.0,
        };

        let env_vars = Self::build_env();

        let mut cmd = Command::new("claude");
        cmd.args([
            "--print",
            "--output-format", "stream-json",
            "--verbose",
            "--agent", &agent_name,
            "--session-id", &session_id,
            "--model", &model,
            &prompt,
        ]);
        cmd.current_dir(&project_dir);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.stdin(Stdio::null());
        cmd.env_clear();
        for (key, value) in &env_vars {
            cmd.env(key, value);
        }

        let mut child = cmd.spawn().map_err(|e| AppError::Process(e.to_string()))?;

        let stdout = child.stdout.take().ok_or_else(|| AppError::Process("No stdout".into()))?;
        let stderr = child.stderr.take().ok_or_else(|| AppError::Process("No stderr".into()))?;

        let _ = app.emit(
            "agent:status-changed",
            AgentStatusEvent {
                session_id: session_id.clone(),
                agent_name: agent_name.clone(),
                status: AgentStatus::Starting,
                model: model.clone(),
                prompt: prompt.clone(),
                ended_at: None,
            },
        );

        self.sessions.write().await.insert(session_id.clone(), session.clone());

        let log_store = self.log_store.get().cloned();

        let reader_handle = Self::spawn_reader_task(
            app,
            Arc::clone(&self.sessions),
            log_store,
            session_id.clone(),
            agent_name,
            model,
            prompt,
            stdout,
            stderr,
            child,
        );

        self.processes.write().await.insert(
            session_id.clone(),
            Arc::new(Mutex::new(RunningProcess {
                session,
                abort_handle: reader_handle,
            })),
        );

        Ok(session_id)
    }

    /// Stop a running agent by session ID.
    pub async fn stop_agent(&self, app: &AppHandle, session_id: &str) -> Result<(), AppError> {
        let process = self
            .processes
            .write()
            .await
            .remove(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let running = process.lock().await;
        running.abort_handle.abort();

        let ended_at = Utc::now().to_rfc3339();
        if let Some(s) = self.sessions.write().await.get_mut(session_id) {
            s.status = AgentStatus::Stopped;
            s.ended_at = Some(ended_at.clone());
        }

        let _ = app.emit(
            "agent:status-changed",
            AgentStatusEvent {
                session_id: session_id.to_string(),
                agent_name: running.session.agent_name.clone(),
                status: AgentStatus::Stopped,
                model: running.session.model.clone(),
                prompt: running.session.prompt.clone(),
                ended_at: Some(ended_at),
            },
        );

        Ok(())
    }

    pub async fn list_sessions(&self) -> Vec<AgentSession> {
        self.sessions.read().await.values().cloned().collect()
    }

    pub async fn get_session(&self, session_id: &str) -> Option<AgentSession> {
        self.sessions.read().await.get(session_id).cloned()
    }

    /// Resume a previously stopped session.
    pub async fn resume_agent(
        &self,
        app: AppHandle,
        session_id: String,
        prompt: String,
    ) -> Result<String, AppError> {
        let project_dir = self
            .project_dir
            .read()
            .await
            .clone()
            .unwrap_or_else(|| ".".to_string());

        let session = self
            .sessions
            .read()
            .await
            .get(&session_id)
            .cloned()
            .ok_or_else(|| AppError::SessionNotFound(session_id.clone()))?;

        let env_vars = Self::build_env();

        let mut cmd = Command::new("claude");
        cmd.args([
            "--print",
            "--output-format", "stream-json",
            "--verbose",
            "--resume", &session_id,
            &prompt,
        ]);
        cmd.current_dir(&project_dir);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.stdin(Stdio::null());
        cmd.env_clear();
        for (key, value) in &env_vars {
            cmd.env(key, value);
        }

        let mut child = cmd.spawn().map_err(|e| AppError::Process(e.to_string()))?;
        let stdout = child.stdout.take().ok_or_else(|| AppError::Process("No stdout".into()))?;
        let stderr = child.stderr.take().ok_or_else(|| AppError::Process("No stderr".into()))?;

        {
            let mut guard = self.sessions.write().await;
            if let Some(s) = guard.get_mut(&session_id) {
                s.status = AgentStatus::Running;
                s.ended_at = None;
            }
        }

        let _ = app.emit(
            "agent:status-changed",
            AgentStatusEvent {
                session_id: session_id.clone(),
                agent_name: session.agent_name.clone(),
                status: AgentStatus::Running,
                model: session.model.clone(),
                prompt: prompt.clone(),
                ended_at: None,
            },
        );

        let log_store = self.log_store.get().cloned();

        let reader_handle = Self::spawn_reader_task(
            app,
            Arc::clone(&self.sessions),
            log_store,
            session_id.clone(),
            session.agent_name,
            session.model,
            prompt,
            stdout,
            stderr,
            child,
        );

        let current_session = self.sessions.read().await.get(&session_id).cloned().unwrap();
        self.processes.write().await.insert(
            session_id.clone(),
            Arc::new(Mutex::new(RunningProcess {
                session: current_session,
                abort_handle: reader_handle,
            })),
        );

        Ok(session_id)
    }

    /// Graceful shutdown: abort all running agent tasks.
    /// Called on app close to prevent orphan processes.
    pub async fn shutdown_all(&self) {
        let mut processes = self.processes.write().await;
        for (sid, process) in processes.drain() {
            let running = process.lock().await;
            running.abort_handle.abort();
            if let Some(s) = self.sessions.write().await.get_mut(&sid) {
                s.status = AgentStatus::Stopped;
                s.ended_at = Some(Utc::now().to_rfc3339());
            }
        }

        // Flush any remaining logs
        if let Some(store) = self.log_store.get() {
            store.flush().await;
        }
    }
}
