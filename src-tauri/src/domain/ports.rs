use super::error::DomainError;
use super::models::{
    AgentSession, AgentStatus, LogEntry, StepStatus, Workflow, WorkflowEdge, WorkflowStatus,
    WorkflowStep,
};
use async_trait::async_trait;

// ---------------------------------------------------------------------------
// Port: AgentRunner — mechanism for running agent processes
// ---------------------------------------------------------------------------

/// Configuration for spawning a new agent.
pub struct SpawnConfig {
    pub session_id: String,
    pub agent_name: String,
    pub model: String,
    pub prompt: String,
    pub project_dir: String,
}

/// Configuration for resuming an existing session.
pub struct ResumeConfig {
    pub session_id: String,
    pub prompt: String,
    pub project_dir: String,
}

/// Port: mechanism for running agent processes.
///
/// Implementations must call back into SessionManager via the provided
/// callback handles when messages arrive or the process terminates.
/// The runner does NOT own session state — it only manages the OS process.
#[async_trait]
pub trait AgentRunner: Send + Sync {
    /// Spawn a new agent process. Returns immediately after spawning.
    async fn spawn(&self, config: SpawnConfig) -> Result<(), DomainError>;

    /// Resume a previously stopped session.
    async fn resume(&self, config: ResumeConfig) -> Result<(), DomainError>;

    /// Kill a running agent process by session ID.
    async fn kill(&self, session_id: &str) -> Result<(), DomainError>;

    /// Kill all running agent processes. Called during app shutdown.
    async fn kill_all(&self);
}

// ---------------------------------------------------------------------------
// Port: EventEmitter — push domain events to external consumers
// ---------------------------------------------------------------------------

/// Domain event: an agent's status changed.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StatusChangedEvent {
    pub session_id: String,
    pub agent_name: String,
    pub status: AgentStatus,
    pub model: String,
    pub prompt: String,
    pub ended_at: Option<String>,
}

/// Domain event: an agent produced a message.
#[derive(Debug, Clone, serde::Serialize)]
pub struct MessageEvent {
    pub session_id: String,
    pub message_type: String,
    pub content: String,
    pub timestamp: String,
}

/// Domain event: token usage updated for a session.
#[derive(Debug, Clone, serde::Serialize)]
pub struct UsageUpdateEvent {
    pub session_id: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    /// Actual cost in USD from Claude Code's result message. Zero for
    /// intermediate updates; set only when the final result arrives.
    pub cost_usd: f64,
}

/// Domain event: Claude quota/rate-limit exceeded.
#[derive(Debug, Clone, serde::Serialize)]
pub struct RateLimitedEvent {
    pub session_id: String,
    /// ISO 8601 reset timestamp if parseable from the error message.
    pub reset_at: Option<String>,
    /// Raw error text for display.
    pub raw_message: String,
}

/// Port: mechanism for emitting domain events to external consumers.
pub trait EventEmitter: Send + Sync {
    fn emit_status_changed(&self, event: StatusChangedEvent) -> Result<(), DomainError>;
    fn emit_agent_message(&self, event: MessageEvent) -> Result<(), DomainError>;
    fn emit_usage_update(&self, event: UsageUpdateEvent) -> Result<(), DomainError>;
    fn emit_rate_limited(&self, event: RateLimitedEvent) -> Result<(), DomainError>;
}

// ---------------------------------------------------------------------------
// Port: LogRepository — log entry persistence and querying
// ---------------------------------------------------------------------------

/// Port: log entry persistence and querying.
#[async_trait]
pub trait LogRepository: Send + Sync {
    /// Buffer a log entry for batch persistence.
    async fn append(
        &self,
        session_id: &str,
        message_type: &str,
        content: &str,
        timestamp: &str,
    );

    /// Force-flush buffered entries to durable storage.
    async fn flush(&self);

    /// Query log entries for a session with pagination.
    async fn query_logs(
        &self,
        session_id: &str,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<LogEntry>, DomainError>;

    /// Get total log count for a session.
    async fn count_logs(&self, session_id: &str) -> Result<u64, DomainError>;

}

// ---------------------------------------------------------------------------
// Port: SessionRepository — session state storage
// ---------------------------------------------------------------------------

/// Port: session state storage.
#[async_trait]
pub trait SessionRepository: Send + Sync {
    async fn save(&self, session: &AgentSession);
    async fn get(&self, session_id: &str) -> Option<AgentSession>;
    async fn list(&self) -> Vec<AgentSession>;
    async fn update_status(
        &self,
        session_id: &str,
        status: AgentStatus,
        ended_at: Option<String>,
    );
    async fn update_usage(
        &self,
        session_id: &str,
        input_tokens: u64,
        output_tokens: u64,
    ) -> (u64, u64);
    async fn update_cost(&self, session_id: &str, cost_usd: f64);
}

// ---------------------------------------------------------------------------
// Port: WorkflowRepository — workflow state persistence
// ---------------------------------------------------------------------------

#[async_trait]
pub trait WorkflowRepository: Send + Sync {
    async fn save_workflow(&self, workflow: &Workflow) -> Result<(), DomainError>;
    async fn get_workflow(&self, id: &str) -> Result<Option<Workflow>, DomainError>;
    async fn list_workflows(&self) -> Result<Vec<Workflow>, DomainError>;
    async fn update_workflow_status(
        &self,
        id: &str,
        status: WorkflowStatus,
    ) -> Result<(), DomainError>;
    async fn delete_workflow(&self, id: &str) -> Result<(), DomainError>;

    async fn save_step(&self, step: &WorkflowStep) -> Result<(), DomainError>;
    async fn update_step_status(
        &self,
        id: &str,
        status: StepStatus,
        session_id: Option<String>,
    ) -> Result<(), DomainError>;
    async fn get_steps(&self, workflow_id: &str) -> Result<Vec<WorkflowStep>, DomainError>;
    async fn update_step(
        &self,
        step: &WorkflowStep,
    ) -> Result<(), DomainError>;
    async fn delete_step(&self, id: &str) -> Result<(), DomainError>;

    async fn update_step_result(&self, id: &str, result_output: &str) -> Result<(), DomainError>;

    async fn save_edge(&self, edge: &WorkflowEdge) -> Result<(), DomainError>;
    async fn get_edges(&self, workflow_id: &str) -> Result<Vec<WorkflowEdge>, DomainError>;
    async fn delete_edge(&self, id: &str) -> Result<(), DomainError>;
}
