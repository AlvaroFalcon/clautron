use crate::domain::models::{AgentConfig, AgentConfigUpdate};
use crate::services::agent_parser;
use crate::services::agent_watcher;
use crate::services::config_store::ConfigStore;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Service for managing agent definition files on disk.
pub struct AgentManager {
    project_dir: RwLock<Option<String>>,
    config_store: Arc<ConfigStore>,
}

impl AgentManager {
    pub fn new(config_store: Arc<ConfigStore>) -> Self {
        Self {
            project_dir: RwLock::new(None),
            config_store,
        }
    }

    pub async fn set_project_dir(&self, path: String) {
        *self.project_dir.write().await = Some(path);
    }

    pub async fn get_project_dir(&self) -> Option<String> {
        self.project_dir.read().await.clone()
    }

    fn agents_dir(project_dir: &str) -> PathBuf {
        Path::new(project_dir).join(".claude/agents")
    }

    /// List all agent configs from .claude/agents/.
    pub async fn list_agents(&self) -> Result<Vec<AgentConfig>, String> {
        let project_dir = self
            .project_dir
            .read()
            .await
            .clone()
            .ok_or("No project directory set")?;

        let agents_dir = Self::agents_dir(&project_dir);
        if !agents_dir.exists() {
            return Ok(vec![]);
        }

        let md_files = agent_watcher::collect_md_files(&agents_dir);
        let mut configs = Vec::new();

        for path in md_files {
            if let Ok(content) = std::fs::read_to_string(&path) {
                let file_path = path.to_string_lossy().to_string();
                match agent_parser::parse_agent(&content, &file_path) {
                    Ok(config) => configs.push(config),
                    Err(e) => {
                        eprintln!("Failed to parse agent {}: {}", file_path, e);
                    }
                }
            }
        }

        configs.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(configs)
    }

    /// Get a single agent by file path.
    pub async fn get_agent(&self, file_path: &str) -> Result<AgentConfig, String> {
        let content = std::fs::read_to_string(file_path).map_err(|e| e.to_string())?;
        agent_parser::parse_agent(&content, file_path)
    }

    /// Create a new agent definition file.
    pub async fn create_agent(
        &self,
        name: String,
        model: String,
        description: String,
        color: String,
    ) -> Result<AgentConfig, String> {
        let project_dir = self
            .project_dir
            .read()
            .await
            .clone()
            .ok_or("No project directory set")?;

        let agents_dir = Self::agents_dir(&project_dir);
        std::fs::create_dir_all(&agents_dir).map_err(|e| e.to_string())?;

        let filename = slugify(&name);
        let file_path = agents_dir.join(format!("{}.md", filename));

        // Ensure unique filename
        let file_path = if file_path.exists() {
            let ts = chrono::Utc::now().timestamp();
            agents_dir.join(format!("{}-{}.md", filename, ts))
        } else {
            file_path
        };

        let config = AgentConfig {
            name,
            description,
            model,
            color,
            file_path: file_path.to_string_lossy().to_string(),
            body: String::new(),
        };

        let content = agent_parser::serialize_agent(&config, None);
        std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;

        // Auto-approve the hash so the approval dialog doesn't fire
        self.auto_approve_hash(&file_path)?;

        Ok(config)
    }

    /// Update an existing agent definition.
    pub async fn update_agent(
        &self,
        file_path: &str,
        update: AgentConfigUpdate,
    ) -> Result<AgentConfig, String> {
        let original_content = std::fs::read_to_string(file_path).map_err(|e| e.to_string())?;
        let current = agent_parser::parse_agent(&original_content, file_path)?;
        let updated = agent_parser::apply_update(&current, &update);
        let content = agent_parser::serialize_agent(&updated, Some(&original_content));
        std::fs::write(file_path, &content).map_err(|e| e.to_string())?;

        // Auto-approve the new hash
        let path = std::path::Path::new(file_path);
        self.auto_approve_hash(path)?;

        Ok(updated)
    }

    /// Delete an agent definition file.
    pub async fn delete_agent(&self, file_path: &str) -> Result<(), String> {
        std::fs::remove_file(file_path).map_err(|e| e.to_string())
    }

    /// Compute SHA-256 hash of the file and update approved hashes in ConfigStore.
    fn auto_approve_hash(&self, path: &std::path::Path) -> Result<(), String> {
        if let Some(hash) = agent_watcher::hash_file(path) {
            let mut config = self.config_store.load();
            let file_path_str = path.to_string_lossy().to_string();
            config
                .approved_agent_hashes
                .insert(file_path_str, hash);
            self.config_store
                .save(&config)
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

/// Convert a name to a URL-safe filename slug.
fn slugify(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<&str>>()
        .join("-")
}
