use crate::domain::models::{AgentConfig, AgentSession};
use crate::domain::session_manager::SessionManager;
use crate::error::AppError;
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
    session_manager: State<'_, Arc<SessionManager>>,
) -> Result<Vec<AgentConfig>, AppError> {
    let project_dir = session_manager
        .get_project_dir()
        .await
        .unwrap_or_else(|| ".".to_string());

    let agents_dir = std::path::Path::new(&project_dir).join(".claude/agents");

    if !agents_dir.exists() {
        return Ok(vec![]);
    }

    let md_files = crate::services::agent_watcher::collect_md_files(&agents_dir);
    let mut configs = Vec::new();

    for path in md_files {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Some(config) = parse_agent_frontmatter(&content, &path) {
                configs.push(config);
            }
        }
    }

    Ok(configs)
}

/// Parse YAML frontmatter from an agent definition file.
fn parse_agent_frontmatter(
    content: &str,
    path: &std::path::Path,
) -> Option<AgentConfig> {
    let content = content.trim();
    if !content.starts_with("---") {
        return None;
    }

    let after_first = &content[3..];
    let end_idx = after_first.find("---")?;
    let frontmatter = &after_first[..end_idx];

    let mut name = None;
    let mut description = None;
    let mut model = None;
    let mut color = None;

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim();
            let value = value.trim().trim_matches('"');
            match key {
                "name" => name = Some(value.to_string()),
                "description" => description = Some(value.to_string()),
                "model" => model = Some(value.to_string()),
                "color" => color = Some(value.to_string()),
                _ => {}
            }
        }
    }

    Some(AgentConfig {
        name: name?,
        description: description.unwrap_or_default(),
        model: model.unwrap_or_else(|| "sonnet".to_string()),
        color: color.unwrap_or_else(|| "gray".to_string()),
        file_path: path.to_string_lossy().to_string(),
    })
}
