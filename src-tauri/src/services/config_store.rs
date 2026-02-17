use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Persistent app configuration stored at ~/.clautron/config.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub project_path: Option<String>,
    pub window_width: Option<f64>,
    pub window_height: Option<f64>,
    /// SHA-256 hashes of approved agent definition files.
    /// Key: file path relative to project, Value: hex-encoded SHA-256 hash.
    #[serde(default)]
    pub approved_agent_hashes: std::collections::HashMap<String, String>,
}

pub struct ConfigStore {
    config_path: PathBuf,
}

impl ConfigStore {
    pub fn new() -> Self {
        let config_dir = dirs::home_dir()
            .map(|h| h.join(".clautron"))
            .unwrap_or_else(|| PathBuf::from(".clautron"));

        Self {
            config_path: config_dir.join("config.json"),
        }
    }

    /// Load config from disk. Returns default if file doesn't exist.
    pub fn load(&self) -> AppConfig {
        match std::fs::read_to_string(&self.config_path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => AppConfig::default(),
        }
    }

    /// Save config to disk with 0600 permissions (P0 Security #6).
    pub fn save(&self, config: &AppConfig) -> Result<(), AppError> {
        if let Some(parent) = self.config_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent)?;
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = std::fs::set_permissions(
                        parent,
                        std::fs::Permissions::from_mode(0o700),
                    );
                }
            }
        }

        let json = serde_json::to_string_pretty(config)?;
        std::fs::write(&self.config_path, &json)?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(
                &self.config_path,
                std::fs::Permissions::from_mode(0o600),
            );
        }

        Ok(())
    }
}
