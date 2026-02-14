use crate::domain::models::*;
use crate::domain::ports::WorkflowRepository;
use crate::error::AppError;
use crate::services::workflow_engine::WorkflowEngine;
use chrono::Utc;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

type WorkflowRepo = Arc<dyn WorkflowRepository>;

#[tauri::command]
pub async fn create_workflow(
    repo: State<'_, WorkflowRepo>,
    name: String,
    description: Option<String>,
) -> Result<Workflow, AppError> {
    let now = Utc::now().to_rfc3339();
    let workflow = Workflow {
        id: Uuid::new_v4().to_string(),
        name,
        description,
        status: WorkflowStatus::Draft,
        created_at: now.clone(),
        updated_at: now,
    };
    repo.save_workflow(&workflow)
        .await
        .map_err(AppError::from)?;
    Ok(workflow)
}

#[tauri::command]
pub async fn get_workflow(
    repo: State<'_, WorkflowRepo>,
    id: String,
) -> Result<Workflow, AppError> {
    repo.get_workflow(&id)
        .await
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::Process(format!("Workflow not found: {id}")))
}

#[tauri::command]
pub async fn list_workflows(
    repo: State<'_, WorkflowRepo>,
) -> Result<Vec<Workflow>, AppError> {
    repo.list_workflows().await.map_err(AppError::from)
}

#[tauri::command]
pub async fn delete_workflow(
    repo: State<'_, WorkflowRepo>,
    id: String,
) -> Result<(), AppError> {
    repo.delete_workflow(&id).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn add_workflow_step(
    repo: State<'_, WorkflowRepo>,
    workflow_id: String,
    agent_name: String,
    model: String,
    prompt: String,
    spec_path: Option<String>,
    position_x: f64,
    position_y: f64,
    pass_context: Option<bool>,
) -> Result<WorkflowStep, AppError> {
    let step = WorkflowStep {
        id: Uuid::new_v4().to_string(),
        workflow_id,
        agent_name,
        model,
        prompt,
        spec_path,
        status: StepStatus::Pending,
        session_id: None,
        position_x,
        position_y,
        created_at: Utc::now().to_rfc3339(),
        pass_context: pass_context.unwrap_or(false),
        result_output: None,
    };
    repo.save_step(&step).await.map_err(AppError::from)?;
    Ok(step)
}

#[tauri::command]
pub async fn update_workflow_step(
    repo: State<'_, WorkflowRepo>,
    step: WorkflowStep,
) -> Result<(), AppError> {
    repo.update_step(&step).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn remove_workflow_step(
    repo: State<'_, WorkflowRepo>,
    id: String,
) -> Result<(), AppError> {
    repo.delete_step(&id).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn get_workflow_steps(
    repo: State<'_, WorkflowRepo>,
    workflow_id: String,
) -> Result<Vec<WorkflowStep>, AppError> {
    repo.get_steps(&workflow_id).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn add_workflow_edge(
    repo: State<'_, WorkflowRepo>,
    workflow_id: String,
    source_step_id: String,
    target_step_id: String,
) -> Result<WorkflowEdge, AppError> {
    let edge = WorkflowEdge {
        id: Uuid::new_v4().to_string(),
        workflow_id,
        source_step_id,
        target_step_id,
    };
    repo.save_edge(&edge).await.map_err(AppError::from)?;
    Ok(edge)
}

#[tauri::command]
pub async fn remove_workflow_edge(
    repo: State<'_, WorkflowRepo>,
    id: String,
) -> Result<(), AppError> {
    repo.delete_edge(&id).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn get_workflow_edges(
    repo: State<'_, WorkflowRepo>,
    workflow_id: String,
) -> Result<Vec<WorkflowEdge>, AppError> {
    repo.get_edges(&workflow_id).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn start_workflow(
    engine: State<'_, Arc<WorkflowEngine>>,
    id: String,
) -> Result<(), AppError> {
    engine.start(&id).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn stop_workflow(
    engine: State<'_, Arc<WorkflowEngine>>,
    id: String,
) -> Result<(), AppError> {
    engine.stop(&id).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn validate_workflow(
    engine: State<'_, Arc<WorkflowEngine>>,
    id: String,
) -> Result<(), AppError> {
    engine.validate(&id).await.map_err(AppError::from)
}
