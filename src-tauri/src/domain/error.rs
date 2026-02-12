use serde::Serialize;

/// Domain-level errors. Infrastructure-agnostic.
#[derive(Debug, thiserror::Error)]
pub enum DomainError {
    #[error("Process error: {0}")]
    Process(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Event emission error: {0}")]
    EventEmission(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("JSON error: {0}")]
    Json(String),
}

impl Serialize for DomainError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<std::io::Error> for DomainError {
    fn from(e: std::io::Error) -> Self {
        DomainError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for DomainError {
    fn from(e: serde_json::Error) -> Self {
        DomainError::Json(e.to_string())
    }
}
