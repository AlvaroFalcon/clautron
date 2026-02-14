use crate::domain::models::{Spec, SpecPriority, SpecStatus, SpecUpdate};
use crate::services::spec_parser;
use std::path::{Path, PathBuf};

/// Service for managing spec markdown files on disk.
pub struct SpecManager {
    project_dir: tokio::sync::RwLock<Option<String>>,
}

impl SpecManager {
    pub fn new() -> Self {
        Self {
            project_dir: tokio::sync::RwLock::new(None),
        }
    }

    pub async fn set_project_dir(&self, path: String) {
        *self.project_dir.write().await = Some(path);
    }

    pub async fn get_project_dir(&self) -> Option<String> {
        self.project_dir.read().await.clone()
    }

    fn specs_dir(project_dir: &str) -> PathBuf {
        Path::new(project_dir).join("specs")
    }

    /// List all specs in the project's specs/ directory.
    pub async fn list_specs(&self) -> Result<Vec<Spec>, String> {
        let project_dir = self
            .project_dir
            .read()
            .await
            .clone()
            .ok_or("No project directory set")?;

        let specs_dir = Self::specs_dir(&project_dir);
        if !specs_dir.exists() {
            return Ok(vec![]);
        }

        let mut specs = Vec::new();
        let entries = std::fs::read_dir(&specs_dir).map_err(|e| e.to_string())?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    let file_path = path.to_string_lossy().to_string();
                    match spec_parser::parse_spec(&content, &file_path) {
                        Ok(spec) => specs.push(spec),
                        Err(e) => {
                            eprintln!("Failed to parse spec {}: {}", file_path, e);
                        }
                    }
                }
            }
        }

        // Sort by updated_at descending
        specs.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(specs)
    }

    /// Get a single spec by file path.
    pub async fn get_spec(&self, file_path: &str) -> Result<Spec, String> {
        let content = std::fs::read_to_string(file_path).map_err(|e| e.to_string())?;
        spec_parser::parse_spec(&content, file_path)
    }

    /// Create a new spec file.
    pub async fn create_spec(&self, title: String, priority: SpecPriority) -> Result<Spec, String> {
        let project_dir = self
            .project_dir
            .read()
            .await
            .clone()
            .ok_or("No project directory set")?;

        let specs_dir = Self::specs_dir(&project_dir);
        std::fs::create_dir_all(&specs_dir).map_err(|e| e.to_string())?;

        // Generate filename from title
        let filename = slugify(&title);
        let file_path = specs_dir.join(format!("{}.md", filename));

        // Ensure unique filename
        let file_path = if file_path.exists() {
            let ts = chrono::Utc::now().timestamp();
            specs_dir.join(format!("{}-{}.md", filename, ts))
        } else {
            file_path
        };

        let now = chrono::Utc::now().to_rfc3339();
        let spec = Spec {
            title,
            priority,
            status: SpecStatus::Draft,
            acceptance_criteria: vec![],
            assigned_agent: None,
            assigned_session_id: None,
            parent_spec: None,
            created_at: now.clone(),
            updated_at: now,
            file_path: file_path.to_string_lossy().to_string(),
            body: String::new(),
        };

        let content = spec_parser::serialize_spec(&spec);
        std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;

        Ok(spec)
    }

    /// Update an existing spec.
    pub async fn update_spec(
        &self,
        file_path: &str,
        update: SpecUpdate,
    ) -> Result<Spec, String> {
        let current = self.get_spec(file_path).await?;
        let updated = spec_parser::apply_update(&current, &update);
        let content = spec_parser::serialize_spec(&updated);
        std::fs::write(file_path, &content).map_err(|e| e.to_string())?;
        Ok(updated)
    }

    /// Delete a spec file.
    pub async fn delete_spec(&self, file_path: &str) -> Result<(), String> {
        std::fs::remove_file(file_path).map_err(|e| e.to_string())
    }

    // --- Lifecycle hooks for spec-agent binding ---

    /// Build a prompt from a spec's body and acceptance criteria.
    pub fn build_prompt_from_spec(spec: &Spec) -> String {
        let mut prompt = String::new();
        prompt.push_str(&format!("# {}\n\n", spec.title));
        prompt.push_str(&spec.body);

        if !spec.acceptance_criteria.is_empty() {
            prompt.push_str("\n\n## Acceptance Criteria\n\n");
            for (i, criterion) in spec.acceptance_criteria.iter().enumerate() {
                prompt.push_str(&format!("{}. {}\n", i + 1, criterion));
            }
        }

        prompt
    }

    /// Assign a spec to an agent and session.
    pub async fn assign_to_agent(
        &self,
        file_path: &str,
        agent_name: &str,
        session_id: &str,
    ) -> Result<Spec, String> {
        self.update_spec(
            file_path,
            SpecUpdate {
                status: Some(SpecStatus::Assigned),
                assigned_agent: Some(Some(agent_name.to_string())),
                assigned_session_id: Some(Some(session_id.to_string())),
                ..Default::default()
            },
        )
        .await
    }

    /// Called when agent starts running. Moves spec to in_progress.
    pub async fn on_agent_started(&self, session_id: &str) -> Option<Spec> {
        if let Some(spec) = self.find_spec_by_session(session_id).await {
            if spec.status == SpecStatus::Assigned {
                if let Ok(updated) = self
                    .update_spec(
                        &spec.file_path,
                        SpecUpdate {
                            status: Some(SpecStatus::InProgress),
                            ..Default::default()
                        },
                    )
                    .await
                {
                    return Some(updated);
                }
            }
        }
        None
    }

    /// Called when agent completes. Moves spec to review.
    pub async fn on_agent_completed(&self, session_id: &str) -> Option<Spec> {
        if let Some(spec) = self.find_spec_by_session(session_id).await {
            if spec.status == SpecStatus::InProgress || spec.status == SpecStatus::Assigned {
                if let Ok(updated) = self
                    .update_spec(
                        &spec.file_path,
                        SpecUpdate {
                            status: Some(SpecStatus::Review),
                            ..Default::default()
                        },
                    )
                    .await
                {
                    return Some(updated);
                }
            }
        }
        None
    }

    /// Find a spec that is bound to a given session ID.
    pub async fn find_spec_by_session(&self, session_id: &str) -> Option<Spec> {
        let specs = self.list_specs().await.ok()?;
        specs
            .into_iter()
            .find(|s| s.assigned_session_id.as_deref() == Some(session_id))
    }
}

/// Convert a title to a URL-safe filename slug.
fn slugify(title: &str) -> String {
    title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<&str>>()
        .join("-")
}
