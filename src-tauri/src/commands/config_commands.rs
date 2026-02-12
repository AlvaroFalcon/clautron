use crate::domain::session_manager::SessionManager;
use crate::error::AppError;
use crate::services::agent_watcher;
use crate::services::config_store::{AppConfig, ConfigStore};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

/// Managed state wrapping the current config.
pub type ConfigState = Arc<RwLock<AppConfig>>;

#[tauri::command]
pub async fn get_config(
    config_state: State<'_, ConfigState>,
) -> Result<AppConfig, AppError> {
    Ok(config_state.read().await.clone())
}

#[tauri::command]
pub async fn save_config(
    config_state: State<'_, ConfigState>,
    config_store: State<'_, Arc<ConfigStore>>,
    config: AppConfig,
) -> Result<(), AppError> {
    config_store.save(&config)?;
    *config_state.write().await = config;
    Ok(())
}

#[tauri::command]
pub async fn set_project_path(
    config_state: State<'_, ConfigState>,
    config_store: State<'_, Arc<ConfigStore>>,
    session_manager: State<'_, Arc<SessionManager>>,
    path: String,
) -> Result<(), AppError> {
    // Update session manager's working directory
    session_manager.set_project_dir(path.clone()).await;

    // Save to persistent config
    let mut config = config_state.read().await.clone();
    config.project_path = Some(path);
    config_store.save(&config)?;
    *config_state.write().await = config;

    Ok(())
}

#[tauri::command]
pub async fn get_project_path(
    config_state: State<'_, ConfigState>,
) -> Result<Option<String>, AppError> {
    Ok(config_state.read().await.project_path.clone())
}

/// Check which agents need approval (P0 Security #4).
#[tauri::command]
pub async fn check_agent_approval(
    config_state: State<'_, ConfigState>,
    session_manager: State<'_, Arc<SessionManager>>,
) -> Result<Vec<agent_watcher::UnapprovedAgent>, AppError> {
    let config = config_state.read().await;
    let project_dir = session_manager
        .get_project_dir()
        .await
        .unwrap_or_else(|| ".".to_string());

    let agents_dir = std::path::Path::new(&project_dir).join(".claude/agents");
    if !agents_dir.exists() {
        return Ok(vec![]);
    }

    let md_files = agent_watcher::collect_md_files(&agents_dir);
    let mut unapproved = Vec::new();

    for path in md_files {
        let rel_path = path
            .strip_prefix(&project_dir)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        let current_hash = match agent_watcher::hash_file(&path) {
            Some(h) => h,
            None => continue,
        };

        let approved_hash = config.approved_agent_hashes.get(&rel_path);

        if approved_hash != Some(&current_hash) {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            let (name, model, description) = parse_basic_frontmatter(&content);

            unapproved.push(agent_watcher::UnapprovedAgent {
                file_path: rel_path,
                name: name.unwrap_or_else(|| {
                    path.file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string()
                }),
                model: model.unwrap_or_else(|| "sonnet".to_string()),
                description: description.unwrap_or_default(),
                hash: current_hash,
            });
        }
    }

    Ok(unapproved)
}

/// Approve a list of agent files by storing their hashes.
#[tauri::command]
pub async fn approve_agents(
    config_state: State<'_, ConfigState>,
    config_store: State<'_, Arc<ConfigStore>>,
    agents: Vec<(String, String)>,
) -> Result<(), AppError> {
    let mut config = config_state.read().await.clone();
    for (path, hash) in agents {
        config.approved_agent_hashes.insert(path, hash);
    }
    config_store.save(&config)?;
    *config_state.write().await = config;
    Ok(())
}

/// Quick frontmatter parser for agent display info.
fn parse_basic_frontmatter(content: &str) -> (Option<String>, Option<String>, Option<String>) {
    let content = content.trim();
    if !content.starts_with("---") {
        return (None, None, None);
    }

    let after_first = &content[3..];
    let end_idx = match after_first.find("---") {
        Some(i) => i,
        None => return (None, None, None),
    };
    let frontmatter = &after_first[..end_idx];

    let mut name = None;
    let mut model = None;
    let mut description = None;

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim();
            let value = value.trim().trim_matches('"');
            match key {
                "name" => name = Some(value.to_string()),
                "model" => model = Some(value.to_string()),
                "description" => description = Some(value.to_string()),
                _ => {}
            }
        }
    }

    (name, model, description)
}
