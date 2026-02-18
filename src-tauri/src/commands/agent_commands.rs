use crate::domain::models::{AgentConfig, AgentConfigUpdate, AgentRelationship, AgentSession};
use crate::domain::ports::WorkflowRepository;
use crate::domain::session_manager::SessionManager;
use crate::error::AppError;
use crate::services::agent_manager::AgentManager;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::process::Command as TokioCommand;

#[tauri::command]
pub async fn start_agent(
    session_manager: State<'_, Arc<SessionManager>>,
    name: String,
    model: String,
    prompt: String,
) -> Result<String, AppError> {
    session_manager
        .start_agent(name, model, prompt)
        .await
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn stop_agent(
    session_manager: State<'_, Arc<SessionManager>>,
    session_id: String,
) -> Result<(), AppError> {
    session_manager
        .stop_agent(&session_id)
        .await
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn resume_agent(
    session_manager: State<'_, Arc<SessionManager>>,
    session_id: String,
    prompt: String,
) -> Result<String, AppError> {
    session_manager
        .resume_agent(session_id, prompt)
        .await
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn list_sessions(
    session_manager: State<'_, Arc<SessionManager>>,
) -> Result<Vec<AgentSession>, AppError> {
    Ok(session_manager.list_sessions().await)
}

#[tauri::command]
pub async fn get_session(
    session_manager: State<'_, Arc<SessionManager>>,
    session_id: String,
) -> Result<AgentSession, AppError> {
    session_manager
        .get_session(&session_id)
        .await
        .ok_or_else(|| AppError::SessionNotFound(session_id))
}

#[tauri::command]
pub async fn set_project_dir(
    session_manager: State<'_, Arc<SessionManager>>,
    path: String,
) -> Result<(), AppError> {
    session_manager.set_project_dir(path).await;
    Ok(())
}

#[tauri::command]
pub async fn get_project_dir(
    session_manager: State<'_, Arc<SessionManager>>,
) -> Result<Option<String>, AppError> {
    Ok(session_manager.get_project_dir().await)
}

/// One-shot Claude generation: runs `claude --print` with the given prompt and
/// returns just the final result text. Used for AI-assisted content generation
/// (e.g. generating agent system prompts) without creating a tracked session.
#[tauri::command]
pub async fn generate_text(prompt: String) -> Result<String, AppError> {
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command;
    use std::process::Stdio;

    const ENV_ALLOWLIST: &[&str] = &[
        "PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR",
        "LANG", "LC_ALL", "XDG_CONFIG_HOME", "XDG_DATA_HOME",
        "TERM", "ANTHROPIC_API_KEY", "CLAUDE_CODE_API_KEY",
    ];

    let work_dir = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());

    let env_vars: Vec<(String, String)> = ENV_ALLOWLIST
        .iter()
        .filter_map(|k| std::env::var(k).ok().map(|v| (k.to_string(), v)))
        .collect();

    // P0 Security: args array, never shell interpolation
    let mut cmd = Command::new("claude");
    cmd.args(["--print", "--output-format", "stream-json", "--verbose", &prompt]);
    cmd.current_dir(&work_dir);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    cmd.stdin(Stdio::null());
    cmd.env_clear();
    for (k, v) in &env_vars {
        cmd.env(k, v);
    }

    let mut child = cmd.spawn().map_err(|e| AppError::Process(e.to_string()))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::Process("No stdout from claude".into()))?;

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        async {
            let mut reader = BufReader::new(stdout).lines();
            let mut result_text = String::new();

            while let Ok(Some(line)) = reader.next_line().await {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&line) {
                    if parsed.get("type").and_then(|t| t.as_str()) == Some("result") {
                        if let Some(text) = parsed.get("result").and_then(|r| r.as_str()) {
                            result_text = text.to_string();
                        }
                    }
                }
            }
            let _ = child.wait().await;
            result_text
        },
    )
    .await
    .map_err(|_| AppError::Process("Generation timed out after 120s".into()))?;

    if result.is_empty() {
        return Err(AppError::Process(
            "Claude returned an empty result. Check authentication.".into(),
        ));
    }

    Ok(result)
}

/// Check if Claude Code CLI is authenticated.
#[tauri::command]
pub async fn check_claude_auth() -> Result<bool, AppError> {
    let mut cmd = TokioCommand::new("claude");
    cmd.args(["--print", "--output-format", "stream-json", "--verbose", "say hello"]);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd.stdin(std::process::Stdio::null());

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        cmd.output(),
    )
    .await
    .map_err(|_| AppError::Process("Auth check timed out".into()))?
    .map_err(|e| AppError::Process(e.to_string()))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    if stdout.contains("\"authentication_failed\"") || stdout.contains("Not logged in") {
        return Ok(false);
    }

    if stdout.contains("\"subtype\":\"init\"") {
        return Ok(true);
    }

    Ok(false)
}

/// Open Terminal.app with `claude` for interactive login.
#[tauri::command]
pub async fn open_claude_login() -> Result<(), AppError> {
    TokioCommand::new("osascript")
        .args([
            "-e",
            "tell application \"Terminal\" to do script \"echo 'Type /login to authenticate, then close this window when done.' && claude\"",
            "-e",
            "tell application \"Terminal\" to activate",
        ])
        .output()
        .await
        .map_err(|e| AppError::Process(e.to_string()))?;
    Ok(())
}

/// List available agent configurations from .claude/agents/ in the project directory.
#[tauri::command]
pub async fn list_agents(
    agent_manager: State<'_, Arc<AgentManager>>,
) -> Result<Vec<AgentConfig>, AppError> {
    agent_manager
        .list_agents()
        .await
        .map_err(|e| AppError::Process(e))
}

/// Get a single agent config by file path.
#[tauri::command]
pub async fn get_agent(
    agent_manager: State<'_, Arc<AgentManager>>,
    file_path: String,
) -> Result<AgentConfig, AppError> {
    agent_manager
        .get_agent(&file_path)
        .await
        .map_err(|e| AppError::Process(e))
}

/// Create a new agent config file.
#[tauri::command]
pub async fn create_agent_config(
    agent_manager: State<'_, Arc<AgentManager>>,
    name: String,
    model: String,
    description: String,
    color: String,
) -> Result<AgentConfig, AppError> {
    agent_manager
        .create_agent(name, model, description, color)
        .await
        .map_err(|e| AppError::Process(e))
}

/// Update an existing agent config.
#[tauri::command]
pub async fn update_agent_config(
    agent_manager: State<'_, Arc<AgentManager>>,
    file_path: String,
    update: AgentConfigUpdate,
) -> Result<AgentConfig, AppError> {
    agent_manager
        .update_agent(&file_path, update)
        .await
        .map_err(|e| AppError::Process(e))
}

/// Delete an agent config file.
#[tauri::command]
pub async fn delete_agent_config(
    agent_manager: State<'_, Arc<AgentManager>>,
    file_path: String,
) -> Result<(), AppError> {
    agent_manager
        .delete_agent(&file_path)
        .await
        .map_err(|e| AppError::Process(e))
}

/// Get agent relationships derived from workflow edges.
#[tauri::command]
pub async fn get_agent_relationships(
    workflow_repo: State<'_, Arc<dyn WorkflowRepository>>,
) -> Result<Vec<AgentRelationship>, AppError> {
    let workflows = workflow_repo
        .list_workflows()
        .await
        .map_err(AppError::from)?;

    // Map: (source_agent, target_agent) -> { workflow_names, edge_count }
    let mut rel_map: HashMap<(String, String), (Vec<String>, usize)> = HashMap::new();

    for workflow in &workflows {
        let steps = workflow_repo
            .get_steps(&workflow.id)
            .await
            .map_err(AppError::from)?;
        let edges = workflow_repo
            .get_edges(&workflow.id)
            .await
            .map_err(AppError::from)?;

        // Build step_id -> agent_name lookup
        let step_agents: HashMap<String, String> = steps
            .iter()
            .map(|s| (s.id.clone(), s.agent_name.clone()))
            .collect();

        for edge in &edges {
            let source_agent = step_agents.get(&edge.source_step_id);
            let target_agent = step_agents.get(&edge.target_step_id);

            if let (Some(src), Some(tgt)) = (source_agent, target_agent) {
                let key = (src.clone(), tgt.clone());
                let entry = rel_map.entry(key).or_insert_with(|| (vec![], 0));
                if !entry.0.contains(&workflow.name) {
                    entry.0.push(workflow.name.clone());
                }
                entry.1 += 1;
            }
        }
    }

    let relationships: Vec<AgentRelationship> = rel_map
        .into_iter()
        .map(|((source_agent, target_agent), (workflow_names, edge_count))| {
            AgentRelationship {
                source_agent,
                target_agent,
                workflow_names,
                edge_count,
            }
        })
        .collect();

    Ok(relationships)
}
