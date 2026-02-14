use crate::domain::models::{Spec, SpecPriority, SpecStatus, SpecUpdate};
use serde::{Deserialize, Serialize};

/// YAML frontmatter structure for spec files.
#[derive(Debug, Serialize, Deserialize)]
struct SpecFrontmatter {
    title: String,
    #[serde(default = "default_priority")]
    priority: String,
    #[serde(default = "default_status")]
    status: String,
    #[serde(default)]
    acceptance_criteria: Vec<String>,
    #[serde(default)]
    assigned_agent: Option<String>,
    #[serde(default)]
    assigned_session_id: Option<String>,
    #[serde(default)]
    parent_spec: Option<String>,
    #[serde(default = "default_timestamp")]
    created_at: String,
    #[serde(default = "default_timestamp")]
    updated_at: String,
}

fn default_priority() -> String {
    "P1".to_string()
}

fn default_status() -> String {
    "draft".to_string()
}

fn default_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn parse_priority(s: &str) -> SpecPriority {
    match s.to_uppercase().as_str() {
        "P0" => SpecPriority::P0,
        "P2" => SpecPriority::P2,
        _ => SpecPriority::P1,
    }
}

fn parse_status(s: &str) -> SpecStatus {
    match s.to_lowercase().as_str() {
        "assigned" => SpecStatus::Assigned,
        "in_progress" => SpecStatus::InProgress,
        "review" => SpecStatus::Review,
        "done" => SpecStatus::Done,
        "rejected" => SpecStatus::Rejected,
        _ => SpecStatus::Draft,
    }
}

/// Parse a spec markdown file into a Spec struct.
pub fn parse_spec(content: &str, file_path: &str) -> Result<Spec, String> {
    let content = content.trim();
    if !content.starts_with("---") {
        return Err("Spec file must start with YAML frontmatter (---)".into());
    }

    let after_first = &content[3..];
    let end_idx = after_first
        .find("---")
        .ok_or("Missing closing --- for frontmatter")?;
    let frontmatter_str = &after_first[..end_idx];
    let body = after_first[end_idx + 3..].trim().to_string();

    let fm: SpecFrontmatter =
        serde_yaml::from_str(frontmatter_str).map_err(|e| format!("YAML parse error: {e}"))?;

    Ok(Spec {
        title: fm.title,
        priority: parse_priority(&fm.priority),
        status: parse_status(&fm.status),
        acceptance_criteria: fm.acceptance_criteria,
        assigned_agent: fm.assigned_agent,
        assigned_session_id: fm.assigned_session_id,
        parent_spec: fm.parent_spec,
        created_at: fm.created_at,
        updated_at: fm.updated_at,
        file_path: file_path.to_string(),
        body,
    })
}

/// Serialize a Spec back to markdown with YAML frontmatter.
pub fn serialize_spec(spec: &Spec) -> String {
    let fm = SpecFrontmatter {
        title: spec.title.clone(),
        priority: spec.priority.to_string(),
        status: spec.status.to_string(),
        acceptance_criteria: spec.acceptance_criteria.clone(),
        assigned_agent: spec.assigned_agent.clone(),
        assigned_session_id: spec.assigned_session_id.clone(),
        parent_spec: spec.parent_spec.clone(),
        created_at: spec.created_at.clone(),
        updated_at: spec.updated_at.clone(),
    };

    let yaml = serde_yaml::to_string(&fm).unwrap_or_default();
    // serde_yaml adds a leading "---\n" but we want to control our own delimiters
    let yaml = yaml.trim().trim_start_matches("---").trim();

    let mut out = String::new();
    out.push_str("---\n");
    out.push_str(yaml);
    out.push_str("\n---\n");
    if !spec.body.is_empty() {
        out.push('\n');
        out.push_str(&spec.body);
        out.push('\n');
    }
    out
}

/// Apply a SpecUpdate to a Spec, returning the updated Spec.
pub fn apply_update(spec: &Spec, update: &SpecUpdate) -> Spec {
    let mut updated = spec.clone();
    if let Some(ref title) = update.title {
        updated.title = title.clone();
    }
    if let Some(ref priority) = update.priority {
        updated.priority = priority.clone();
    }
    if let Some(ref status) = update.status {
        updated.status = status.clone();
    }
    if let Some(ref criteria) = update.acceptance_criteria {
        updated.acceptance_criteria = criteria.clone();
    }
    if let Some(ref agent) = update.assigned_agent {
        updated.assigned_agent = agent.clone();
    }
    if let Some(ref session_id) = update.assigned_session_id {
        updated.assigned_session_id = session_id.clone();
    }
    if let Some(ref parent) = update.parent_spec {
        updated.parent_spec = parent.clone();
    }
    if let Some(ref body) = update.body {
        updated.body = body.clone();
    }
    updated.updated_at = chrono::Utc::now().to_rfc3339();
    updated
}
