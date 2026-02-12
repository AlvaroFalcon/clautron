use crate::error::AppError;
use crate::models::session::LogEntry;
use crate::services::log_store::LogStore;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn get_session_logs(
    log_store: State<'_, Arc<LogStore>>,
    session_id: String,
    offset: Option<u32>,
    limit: Option<u32>,
) -> Result<Vec<LogEntry>, AppError> {
    log_store
        .get_session_logs(&session_id, offset.unwrap_or(0), limit.unwrap_or(500))
        .await
}

#[tauri::command]
pub async fn get_session_log_count(
    log_store: State<'_, Arc<LogStore>>,
    session_id: String,
) -> Result<u64, AppError> {
    log_store.get_session_log_count(&session_id).await
}
