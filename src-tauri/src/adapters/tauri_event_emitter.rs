use crate::domain::error::DomainError;
use crate::domain::ports::{EventEmitter, MessageEvent, StatusChangedEvent, UsageUpdateEvent};
use tauri::{AppHandle, Emitter};

/// EventEmitter adapter that pushes events via Tauri IPC.
pub struct TauriEventEmitter {
    app: AppHandle,
}

impl TauriEventEmitter {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl EventEmitter for TauriEventEmitter {
    fn emit_status_changed(&self, event: StatusChangedEvent) -> Result<(), DomainError> {
        self.app
            .emit("agent:status-changed", event)
            .map_err(|e| DomainError::EventEmission(e.to_string()))
    }

    fn emit_agent_message(&self, event: MessageEvent) -> Result<(), DomainError> {
        self.app
            .emit("agent:message", event)
            .map_err(|e| DomainError::EventEmission(e.to_string()))
    }

    fn emit_usage_update(&self, event: UsageUpdateEvent) -> Result<(), DomainError> {
        self.app
            .emit("agent:usage-update", event)
            .map_err(|e| DomainError::EventEmission(e.to_string()))
    }
}
