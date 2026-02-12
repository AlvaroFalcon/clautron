use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Process error: {0}")]
    Process(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<crate::domain::error::DomainError> for AppError {
    fn from(e: crate::domain::error::DomainError) -> Self {
        match e {
            crate::domain::error::DomainError::Process(s) => AppError::Process(s),
            crate::domain::error::DomainError::SessionNotFound(s) => AppError::SessionNotFound(s),
            crate::domain::error::DomainError::AgentNotFound(s) => AppError::AgentNotFound(s),
            crate::domain::error::DomainError::Database(s) => AppError::Database(s),
            crate::domain::error::DomainError::EventEmission(s) => AppError::Process(s),
            crate::domain::error::DomainError::Io(s) => AppError::Process(s),
            crate::domain::error::DomainError::Json(s) => AppError::Process(s),
        }
    }
}
