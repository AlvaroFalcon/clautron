use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A single message from Claude Code's stream-json output.
/// Actual observed top-level types: system, assistant, user, result.
/// (tool_use and tool_result are nested inside assistant/user content blocks.)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamMessage {
    System(SystemMessage),
    Assistant(AssistantMessage),
    User(UserMessage),
    Result(ResultMessage),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMessage {
    pub subtype: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMessage {
    pub message: Option<serde_json::Value>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMessage {
    pub message: Option<serde_json::Value>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultMessage {
    pub subtype: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl StreamMessage {
    pub fn message_type(&self) -> &str {
        match self {
            StreamMessage::System(_) => "system",
            StreamMessage::Assistant(_) => "assistant",
            StreamMessage::User(_) => "user",
            StreamMessage::Result(_) => "result",
        }
    }
}
