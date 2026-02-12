use serde::{Deserialize, Serialize};

use super::agent::AgentStatus;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSession {
    pub id: String,
    pub agent_name: String,
    pub model: String,
    pub status: AgentStatus,
    pub prompt: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: u64,
    pub session_id: String,
    pub message_type: String,
    pub content: String,
    pub timestamp: String,
}
