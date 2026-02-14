use crate::domain::session_manager::SessionManager;
use crate::error::AppError;
use crate::services::git_service::{ChangedFile, FileDiff};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn get_changed_files(
    session_manager: State<'_, Arc<SessionManager>>,
) -> Result<Vec<ChangedFile>, AppError> {
    let project_dir = session_manager
        .get_project_dir()
        .await
        .unwrap_or_else(|| ".".to_string());

    crate::services::git_service::get_changed_files(&project_dir)
        .map_err(|e| AppError::Process(e))
}

#[tauri::command]
pub async fn get_diff(
    session_manager: State<'_, Arc<SessionManager>>,
    paths: Option<Vec<String>>,
) -> Result<Vec<FileDiff>, AppError> {
    let project_dir = session_manager
        .get_project_dir()
        .await
        .unwrap_or_else(|| ".".to_string());

    crate::services::git_service::get_diff(&project_dir, paths)
        .map_err(|e| AppError::Process(e))
}
