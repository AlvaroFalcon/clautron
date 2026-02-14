use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// --- Spec ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SpecStatus {
    Draft,
    Assigned,
    InProgress,
    Review,
    Done,
    Rejected,
}

impl std::fmt::Display for SpecStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SpecStatus::Draft => write!(f, "draft"),
            SpecStatus::Assigned => write!(f, "assigned"),
            SpecStatus::InProgress => write!(f, "in_progress"),
            SpecStatus::Review => write!(f, "review"),
            SpecStatus::Done => write!(f, "done"),
            SpecStatus::Rejected => write!(f, "rejected"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SpecPriority {
    P0,
    P1,
    P2,
}

impl std::fmt::Display for SpecPriority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SpecPriority::P0 => write!(f, "P0"),
            SpecPriority::P1 => write!(f, "P1"),
            SpecPriority::P2 => write!(f, "P2"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Spec {
    pub title: String,
    pub priority: SpecPriority,
    pub status: SpecStatus,
    pub acceptance_criteria: Vec<String>,
    pub assigned_agent: Option<String>,
    pub assigned_session_id: Option<String>,
    pub parent_spec: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub file_path: String,
    pub body: String,
}

/// Fields that can be updated on a spec.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SpecUpdate {
    pub title: Option<String>,
    pub priority: Option<SpecPriority>,
    pub status: Option<SpecStatus>,
    pub acceptance_criteria: Option<Vec<String>>,
    pub assigned_agent: Option<Option<String>>,
    pub assigned_session_id: Option<Option<String>>,
    pub parent_spec: Option<Option<String>>,
    pub body: Option<String>,
}

// --- Agent Config ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub name: String,
    pub description: String,
    pub model: String,
    pub color: String,
    pub file_path: String,
}

// --- Agent Status ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Idle,
    Starting,
    Running,
    Completed,
    Error,
    Stopped,
}

impl std::fmt::Display for AgentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentStatus::Idle => write!(f, "idle"),
            AgentStatus::Starting => write!(f, "starting"),
            AgentStatus::Running => write!(f, "running"),
            AgentStatus::Completed => write!(f, "completed"),
            AgentStatus::Error => write!(f, "error"),
            AgentStatus::Stopped => write!(f, "stopped"),
        }
    }
}

// --- Session ---

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

// --- Log Entry ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: u64,
    pub session_id: String,
    pub message_type: String,
    pub content: String,
    pub timestamp: String,
}

// --- Workflows ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStatus {
    Draft,
    Ready,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for WorkflowStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WorkflowStatus::Draft => write!(f, "draft"),
            WorkflowStatus::Ready => write!(f, "ready"),
            WorkflowStatus::Running => write!(f, "running"),
            WorkflowStatus::Completed => write!(f, "completed"),
            WorkflowStatus::Failed => write!(f, "failed"),
            WorkflowStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

impl std::fmt::Display for StepStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StepStatus::Pending => write!(f, "pending"),
            StepStatus::Running => write!(f, "running"),
            StepStatus::Completed => write!(f, "completed"),
            StepStatus::Failed => write!(f, "failed"),
            StepStatus::Skipped => write!(f, "skipped"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: WorkflowStatus,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub id: String,
    pub workflow_id: String,
    pub agent_name: String,
    pub model: String,
    pub prompt: String,
    pub spec_path: Option<String>,
    pub status: StepStatus,
    pub session_id: Option<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowEdge {
    pub id: String,
    pub workflow_id: String,
    pub source_step_id: String,
    pub target_step_id: String,
}

// --- File Changes ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub id: u64,
    pub session_id: String,
    pub file_path: String,
    pub operation: String,
    pub timestamp: String,
}

// --- Stream Messages ---

/// A single message from Claude Code's stream-json output.
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
