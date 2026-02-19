use crate::domain::models::{AgentSession, AgentStatus};
use crate::domain::ports::SessionRepository;
use async_trait::async_trait;
use std::collections::HashMap;
use tokio::sync::RwLock;

/// SessionRepository adapter that stores sessions in memory.
pub struct InMemorySessionRepository {
    sessions: RwLock<HashMap<String, AgentSession>>,
}

impl InMemorySessionRepository {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }
}

#[async_trait]
impl SessionRepository for InMemorySessionRepository {
    async fn save(&self, session: &AgentSession) {
        self.sessions
            .write()
            .await
            .insert(session.id.clone(), session.clone());
    }

    async fn get(&self, session_id: &str) -> Option<AgentSession> {
        self.sessions.read().await.get(session_id).cloned()
    }

    async fn list(&self) -> Vec<AgentSession> {
        self.sessions.read().await.values().cloned().collect()
    }

    async fn update_status(
        &self,
        session_id: &str,
        status: AgentStatus,
        ended_at: Option<String>,
    ) {
        if let Some(s) = self.sessions.write().await.get_mut(session_id) {
            s.status = status;
            s.ended_at = ended_at;
        }
    }

    async fn update_usage(
        &self,
        session_id: &str,
        input_tokens: u64,
        output_tokens: u64,
    ) -> (u64, u64) {
        let mut guard = self.sessions.write().await;
        if let Some(s) = guard.get_mut(session_id) {
            s.input_tokens += input_tokens;
            s.output_tokens += output_tokens;
            (s.input_tokens, s.output_tokens)
        } else {
            (0, 0)
        }
    }

    async fn update_cost(&self, session_id: &str, cost_usd: f64) {
        if let Some(s) = self.sessions.write().await.get_mut(session_id) {
            s.cost_usd = cost_usd;
        }
    }
}
