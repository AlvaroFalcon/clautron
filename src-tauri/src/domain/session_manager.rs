use super::error::DomainError;
use super::models::{AgentSession, AgentStatus};
use super::ports::{
    AgentRunner, EventEmitter, LogRepository, MessageEvent, ResumeConfig, SessionRepository,
    SpawnConfig, StatusChangedEvent, UsageUpdateEvent,
};
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Core domain service for agent session orchestration.
///
/// SessionManager owns the business logic for starting, stopping, resuming agents
/// and processing their output. It delegates infrastructure concerns to port
/// implementations (AgentRunner, EventEmitter, LogRepository, SessionRepository).
pub struct SessionManager {
    runner: RwLock<Option<Arc<dyn AgentRunner>>>,
    emitter: Arc<dyn EventEmitter>,
    logs: Arc<dyn LogRepository>,
    sessions: Arc<dyn SessionRepository>,
    project_dir: RwLock<Option<String>>,
}

impl SessionManager {
    pub fn new(
        emitter: Arc<dyn EventEmitter>,
        logs: Arc<dyn LogRepository>,
        sessions: Arc<dyn SessionRepository>,
    ) -> Self {
        Self {
            runner: RwLock::new(None),
            emitter,
            logs,
            sessions,
            project_dir: RwLock::new(None),
        }
    }

    /// Set the AgentRunner after construction (needed to break circular Arc reference).
    pub async fn set_runner(&self, runner: Arc<dyn AgentRunner>) {
        *self.runner.write().await = Some(runner);
    }

    pub async fn set_project_dir(&self, path: String) {
        *self.project_dir.write().await = Some(path);
    }

    pub async fn get_project_dir(&self) -> Option<String> {
        self.project_dir.read().await.clone()
    }

    /// Start a new agent session.
    pub async fn start_agent(
        &self,
        agent_name: String,
        model: String,
        prompt: String,
    ) -> Result<String, DomainError> {
        let project_dir = self
            .project_dir
            .read()
            .await
            .clone()
            .unwrap_or_else(|| ".".to_string());

        let session_id = Uuid::new_v4().to_string();

        let session = AgentSession {
            id: session_id.clone(),
            agent_name: agent_name.clone(),
            model: model.clone(),
            status: AgentStatus::Starting,
            prompt: prompt.clone(),
            started_at: Utc::now().to_rfc3339(),
            ended_at: None,
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0.0,
        };

        // Persist session state
        self.sessions.save(&session).await;

        // Emit starting status
        let _ = self.emitter.emit_status_changed(StatusChangedEvent {
            session_id: session_id.clone(),
            agent_name: agent_name.clone(),
            status: AgentStatus::Starting,
            model: model.clone(),
            prompt: prompt.clone(),
            ended_at: None,
        });

        // Delegate process spawning to the runner
        let runner = self.runner.read().await;
        let runner = runner
            .as_ref()
            .ok_or_else(|| DomainError::Process("AgentRunner not initialized".into()))?;

        runner
            .spawn(SpawnConfig {
                session_id: session_id.clone(),
                agent_name,
                model,
                prompt,
                project_dir,
            })
            .await?;

        Ok(session_id)
    }

    /// Stop a running agent by session ID.
    pub async fn stop_agent(&self, session_id: &str) -> Result<(), DomainError> {
        let session = self
            .sessions
            .get(session_id)
            .await
            .ok_or_else(|| DomainError::SessionNotFound(session_id.to_string()))?;

        let runner = self.runner.read().await;
        let runner = runner
            .as_ref()
            .ok_or_else(|| DomainError::Process("AgentRunner not initialized".into()))?;

        runner.kill(session_id).await?;

        let ended_at = Utc::now().to_rfc3339();
        self.sessions
            .update_status(session_id, AgentStatus::Stopped, Some(ended_at.clone()))
            .await;

        let _ = self.emitter.emit_status_changed(StatusChangedEvent {
            session_id: session_id.to_string(),
            agent_name: session.agent_name,
            status: AgentStatus::Stopped,
            model: session.model,
            prompt: session.prompt,
            ended_at: Some(ended_at),
        });

        Ok(())
    }

    /// Resume a previously stopped session.
    pub async fn resume_agent(
        &self,
        session_id: String,
        prompt: String,
    ) -> Result<String, DomainError> {
        let project_dir = self
            .project_dir
            .read()
            .await
            .clone()
            .unwrap_or_else(|| ".".to_string());

        let session = self
            .sessions
            .get(&session_id)
            .await
            .ok_or_else(|| DomainError::SessionNotFound(session_id.clone()))?;

        // Update status to running
        self.sessions
            .update_status(&session_id, AgentStatus::Running, None)
            .await;

        let _ = self.emitter.emit_status_changed(StatusChangedEvent {
            session_id: session_id.clone(),
            agent_name: session.agent_name.clone(),
            status: AgentStatus::Running,
            model: session.model.clone(),
            prompt: prompt.clone(),
            ended_at: None,
        });

        // Delegate to runner
        let runner = self.runner.read().await;
        let runner = runner
            .as_ref()
            .ok_or_else(|| DomainError::Process("AgentRunner not initialized".into()))?;

        runner
            .resume(ResumeConfig {
                session_id: session_id.clone(),
                prompt,
                project_dir,
            })
            .await?;

        Ok(session_id)
    }

    pub async fn list_sessions(&self) -> Vec<AgentSession> {
        self.sessions.list().await
    }

    pub async fn get_session(&self, session_id: &str) -> Option<AgentSession> {
        self.sessions.get(session_id).await
    }

    /// Graceful shutdown: kill all running agents and flush logs.
    pub async fn shutdown_all(&self) {
        let runner = self.runner.read().await;
        if let Some(runner) = runner.as_ref() {
            runner.kill_all().await;
        }

        // Mark all running sessions as stopped
        for session in self.sessions.list().await {
            if session.status == AgentStatus::Running || session.status == AgentStatus::Starting {
                self.sessions
                    .update_status(
                        &session.id,
                        AgentStatus::Stopped,
                        Some(Utc::now().to_rfc3339()),
                    )
                    .await;
            }
        }

        self.logs.flush().await;
    }

    // -----------------------------------------------------------------------
    // Callback methods — invoked by the AgentRunner adapter
    // -----------------------------------------------------------------------

    /// Called when the agent process transitions to Running.
    pub async fn on_agent_running(&self, session_id: &str) {
        self.sessions
            .update_status(session_id, AgentStatus::Running, None)
            .await;

        if let Some(session) = self.sessions.get(session_id).await {
            let _ = self.emitter.emit_status_changed(StatusChangedEvent {
                session_id: session_id.to_string(),
                agent_name: session.agent_name,
                status: AgentStatus::Running,
                model: session.model,
                prompt: session.prompt,
                ended_at: None,
            });
        }
    }

    /// Called for each parsed message from the agent's stdout/stderr.
    pub async fn on_agent_message(
        &self,
        session_id: &str,
        msg_type: &str,
        content: &str,
        timestamp: &str,
    ) {
        // Emit to frontend
        let _ = self.emitter.emit_agent_message(MessageEvent {
            session_id: session_id.to_string(),
            message_type: msg_type.to_string(),
            content: content.to_string(),
            timestamp: timestamp.to_string(),
        });

        // Persist to log store
        self.logs
            .append(session_id, msg_type, content, timestamp)
            .await;
    }

    /// Called when token usage is extracted from an assistant message.
    pub async fn on_agent_usage(
        &self,
        session_id: &str,
        input_tokens: u64,
        output_tokens: u64,
    ) {
        let (total_in, total_out) = self
            .sessions
            .update_usage(session_id, input_tokens, output_tokens)
            .await;

        let _ = self.emitter.emit_usage_update(UsageUpdateEvent {
            session_id: session_id.to_string(),
            input_tokens: total_in,
            output_tokens: total_out,
        });
    }

    /// Called when the agent process finishes (success, error, or stopped).
    pub async fn on_agent_finished(&self, session_id: &str, status: AgentStatus) {
        let ended_at = Utc::now().to_rfc3339();
        self.sessions
            .update_status(session_id, status.clone(), Some(ended_at.clone()))
            .await;

        self.logs.flush().await;

        if let Some(session) = self.sessions.get(session_id).await {
            let _ = self.emitter.emit_status_changed(StatusChangedEvent {
                session_id: session_id.to_string(),
                agent_name: session.agent_name,
                status,
                model: session.model,
                prompt: session.prompt,
                ended_at: Some(ended_at),
            });
        }
    }
}
