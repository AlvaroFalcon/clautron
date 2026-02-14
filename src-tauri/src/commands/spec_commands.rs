use crate::domain::models::{Spec, SpecPriority, SpecUpdate};
use crate::domain::session_manager::SessionManager;
use crate::error::AppError;
use crate::services::spec_manager::SpecManager;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn list_specs(
    spec_manager: State<'_, Arc<SpecManager>>,
) -> Result<Vec<Spec>, AppError> {
    spec_manager
        .list_specs()
        .await
        .map_err(|e| AppError::Process(e))
}

#[tauri::command]
pub async fn get_spec(
    spec_manager: State<'_, Arc<SpecManager>>,
    file_path: String,
) -> Result<Spec, AppError> {
    spec_manager
        .get_spec(&file_path)
        .await
        .map_err(|e| AppError::Process(e))
}

#[tauri::command]
pub async fn create_spec(
    spec_manager: State<'_, Arc<SpecManager>>,
    title: String,
    priority: SpecPriority,
) -> Result<Spec, AppError> {
    spec_manager
        .create_spec(title, priority)
        .await
        .map_err(|e| AppError::Process(e))
}

#[tauri::command]
pub async fn update_spec(
    spec_manager: State<'_, Arc<SpecManager>>,
    file_path: String,
    update: SpecUpdate,
) -> Result<Spec, AppError> {
    spec_manager
        .update_spec(&file_path, update)
        .await
        .map_err(|e| AppError::Process(e))
}

#[tauri::command]
pub async fn delete_spec(
    spec_manager: State<'_, Arc<SpecManager>>,
    file_path: String,
) -> Result<(), AppError> {
    spec_manager
        .delete_spec(&file_path)
        .await
        .map_err(|e| AppError::Process(e))
}

/// Run a spec by assigning it to an agent and starting the agent.
#[tauri::command]
pub async fn run_spec(
    spec_manager: State<'_, Arc<SpecManager>>,
    session_manager: State<'_, Arc<SessionManager>>,
    spec_path: String,
    agent_name: String,
    model: String,
) -> Result<String, AppError> {
    // Read the spec
    let spec = spec_manager
        .get_spec(&spec_path)
        .await
        .map_err(|e| AppError::Process(e))?;

    // Build prompt from spec
    let prompt = SpecManager::build_prompt_from_spec(&spec);

    // Start the agent
    let session_id = session_manager
        .start_agent(agent_name.clone(), model, prompt)
        .await
        .map_err(AppError::from)?;

    // Bind spec to agent/session
    spec_manager
        .assign_to_agent(&spec_path, &agent_name, &session_id)
        .await
        .map_err(|e| AppError::Process(e))?;

    Ok(session_id)
}
