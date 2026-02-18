use crate::domain::models::{AgentConfig, AgentConfigUpdate};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// YAML frontmatter structure for agent definition files.
#[derive(Debug, Serialize, Deserialize)]
struct AgentFrontmatter {
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default = "default_model")]
    model: String,
    #[serde(default = "default_color")]
    color: String,
    /// Preserve unknown frontmatter fields (e.g. `memory: project`).
    #[serde(flatten)]
    extra: HashMap<String, serde_yaml::Value>,
}

fn default_model() -> String {
    "sonnet".to_string()
}

fn default_color() -> String {
    "gray".to_string()
}

/// Parse an agent markdown file into an AgentConfig.
pub fn parse_agent(content: &str, file_path: &str) -> Result<AgentConfig, String> {
    let content = content.trim();
    if !content.starts_with("---") {
        return Err("Agent file must start with YAML frontmatter (---)".into());
    }

    let after_first = &content[3..];
    let end_idx = after_first
        .find("---")
        .ok_or("Missing closing --- for frontmatter")?;
    let frontmatter_str = &after_first[..end_idx];
    let body = after_first[end_idx + 3..].trim().to_string();

    let fm: AgentFrontmatter =
        serde_yaml::from_str(frontmatter_str).map_err(|e| format!("YAML parse error: {e}"))?;

    Ok(AgentConfig {
        name: fm.name,
        description: fm.description,
        model: fm.model,
        color: fm.color,
        file_path: file_path.to_string(),
        body,
    })
}

/// Serialize an AgentConfig back to markdown with YAML frontmatter.
/// Preserves extra fields from the original file if available.
pub fn serialize_agent(config: &AgentConfig, original_content: Option<&str>) -> String {
    // Try to preserve extra frontmatter fields from the original
    let extra = if let Some(content) = original_content {
        parse_extra_fields(content).unwrap_or_default()
    } else {
        HashMap::new()
    };

    let fm = AgentFrontmatter {
        name: config.name.clone(),
        description: config.description.clone(),
        model: config.model.clone(),
        color: config.color.clone(),
        extra,
    };

    let yaml = serde_yaml::to_string(&fm).unwrap_or_default();
    let yaml = yaml.trim().trim_start_matches("---").trim();

    let mut out = String::new();
    out.push_str("---\n");
    out.push_str(yaml);
    out.push_str("\n---\n");
    if !config.body.is_empty() {
        out.push('\n');
        out.push_str(&config.body);
        out.push('\n');
    }
    out
}

/// Apply an AgentConfigUpdate to an AgentConfig, returning the updated config.
pub fn apply_update(config: &AgentConfig, update: &AgentConfigUpdate) -> AgentConfig {
    let mut updated = config.clone();
    if let Some(ref name) = update.name {
        updated.name = name.clone();
    }
    if let Some(ref description) = update.description {
        updated.description = description.clone();
    }
    if let Some(ref model) = update.model {
        updated.model = model.clone();
    }
    if let Some(ref color) = update.color {
        updated.color = color.clone();
    }
    if let Some(ref body) = update.body {
        updated.body = body.clone();
    }
    updated
}

/// Extract extra (non-standard) frontmatter fields from content.
fn parse_extra_fields(content: &str) -> Option<HashMap<String, serde_yaml::Value>> {
    let content = content.trim();
    if !content.starts_with("---") {
        return None;
    }
    let after_first = &content[3..];
    let end_idx = after_first.find("---")?;
    let frontmatter_str = &after_first[..end_idx];

    let fm: AgentFrontmatter = serde_yaml::from_str(frontmatter_str).ok()?;
    Some(fm.extra)
}
