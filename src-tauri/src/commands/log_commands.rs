use crate::domain::models::LogEntry;
use crate::domain::ports::LogRepository;
use crate::error::AppError;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn get_session_logs(
    log_repo: State<'_, Arc<dyn LogRepository>>,
    session_id: String,
    offset: Option<u32>,
    limit: Option<u32>,
) -> Result<Vec<LogEntry>, AppError> {
    log_repo
        .query_logs(&session_id, offset.unwrap_or(0), limit.unwrap_or(500))
        .await
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn get_session_log_count(
    log_repo: State<'_, Arc<dyn LogRepository>>,
    session_id: String,
) -> Result<u64, AppError> {
    log_repo
        .count_logs(&session_id)
        .await
        .map_err(AppError::from)
}
