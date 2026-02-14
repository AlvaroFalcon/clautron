pub mod adapters;
mod commands;
pub mod domain;
mod error;

use adapters::claude_cli_runner::ClaudeCliRunner;
use adapters::in_memory_session_repository::InMemorySessionRepository;
use adapters::sqlite_log_repository::SqliteLogRepository;
use adapters::tauri_event_emitter::TauriEventEmitter;
use adapters::sqlite_workflow_repository::SqliteWorkflowRepository;
use commands::{agent_commands, config_commands, log_commands, review_commands, spec_commands, workflow_commands};
use domain::ports::WorkflowRepository;
use services::workflow_engine::WorkflowEngine;
use domain::ports::LogRepository;
use domain::session_manager::SessionManager;
use services::agent_watcher;
use services::config_store::ConfigStore;
use services::spec_manager::SpecManager;
use std::sync::Arc;
use tauri::{Emitter, Listener, Manager};
use tokio::sync::RwLock;

// Keep services module for config_store and agent_watcher (no trait needed)
mod services;

#[derive(Clone, serde::Serialize)]
struct SpecStatusChangedPayload {
    file_path: String,
    status: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Set up app data directory
    let data_dir = dirs::home_dir()
        .map(|h| h.join(".agents-mission-control"))
        .unwrap_or_else(|| std::path::PathBuf::from(".agents-mission-control"));

    // Ensure the directory exists with 0700 permissions (P0 Security #6)
    if !data_dir.exists() {
        let _ = std::fs::create_dir_all(&data_dir);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&data_dir, std::fs::Permissions::from_mode(0o700));
        }
    }

    // --- Adapter construction ---

    // Log repository (SQLite)
    let db_file = data_dir.join("data.db").to_string_lossy().to_string();
    let log_repo = Arc::new(SqliteLogRepository::new(db_file));

    // Session repository (in-memory)
    let session_repo = Arc::new(InMemorySessionRepository::new());

    // Config store (JSON) — no trait, concrete type
    let config_store = Arc::new(ConfigStore::new());
    let config = config_store.load();

    // --- Domain service construction ---
    // EventEmitter needs AppHandle, which is only available in setup().
    // We create SessionManager with a placeholder and set the runner later.
    // Use a two-phase init: create SM first, then runner, then link them.

    // We need the AppHandle from setup, so we defer full wiring.
    // Store the log_repo and session_repo for later use.
    let log_repo_for_setup = Arc::clone(&log_repo);
    let log_repo_for_state: Arc<dyn LogRepository> = Arc::clone(&log_repo) as Arc<dyn LogRepository>;
    let log_repo_for_engine: Arc<dyn LogRepository> = Arc::clone(&log_repo) as Arc<dyn LogRepository>;
    let session_repo_for_state = Arc::clone(&session_repo);

    // Restore project dir from saved config
    let project_path_for_setup = config.project_path.clone();

    let config_state: config_commands::ConfigState = Arc::new(RwLock::new(config));

    // Spec manager
    let spec_manager = Arc::new(SpecManager::new());
    if let Some(ref path) = project_path_for_setup {
        let sm = Arc::clone(&spec_manager);
        let path = path.clone();
        tauri::async_runtime::block_on(async move {
            sm.set_project_dir(path).await;
        });
    }

    let spec_manager_for_state = Arc::clone(&spec_manager);

    // Workflow repository (SQLite)
    let workflow_db_path = data_dir.join("data.db").to_string_lossy().to_string();
    let workflow_repo: Arc<dyn WorkflowRepository> =
        Arc::new(SqliteWorkflowRepository::new(workflow_db_path));
    let workflow_repo_for_state = Arc::clone(&workflow_repo);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            // --- Wire up hexagonal architecture ---
            let app_handle = app.handle().clone();

            // EventEmitter adapter (needs AppHandle)
            let emitter = Arc::new(TauriEventEmitter::new(app_handle.clone()));

            // SessionManager (domain core)
            let session_manager = Arc::new(SessionManager::new(
                emitter,
                log_repo_for_state,
                session_repo_for_state,
            ));

            // ClaudeCliRunner adapter (needs SessionManager reference)
            let runner = Arc::new(ClaudeCliRunner::new(Arc::clone(&session_manager)));

            // Link runner into session manager (breaks circular dep)
            let sm = Arc::clone(&session_manager);
            tauri::async_runtime::spawn(async move {
                sm.set_runner(runner).await;
            });

            // Restore project dir from saved config
            if let Some(ref project_path) = project_path_for_setup {
                let sm = Arc::clone(&session_manager);
                let path = project_path.clone();
                tauri::async_runtime::spawn(async move {
                    sm.set_project_dir(path).await;
                });
            }

            // Initialize SQLite and start periodic flush
            let lr = Arc::clone(&log_repo_for_setup);
            tauri::async_runtime::spawn(async move {
                if let Err(e) = lr.init().await {
                    eprintln!("Failed to init log store: {e}");
                }
                lr.start_flush_task();
            });

            // Start FS watchers for .claude/agents/ and specs/ if project is configured
            let sm_for_watcher = Arc::clone(&session_manager);
            tauri::async_runtime::spawn(async move {
                if let Some(project_dir) = sm_for_watcher.get_project_dir().await {
                    let agents_dir =
                        std::path::PathBuf::from(&project_dir).join(".claude/agents");
                    if let Some(watcher) =
                        agent_watcher::start_watching(app_handle.clone(), agents_dir)
                    {
                        std::mem::forget(watcher);
                    }

                    let specs_dir =
                        std::path::PathBuf::from(&project_dir).join("specs");
                    if let Some(watcher) =
                        crate::services::spec_watcher::start_watching(app_handle, specs_dir)
                    {
                        std::mem::forget(watcher);
                    }
                }
            });

            // Workflow engine (needs session_manager + repo + logs)
            let workflow_engine = Arc::new(WorkflowEngine::new(
                Arc::clone(&workflow_repo),
                Arc::clone(&session_manager),
                log_repo_for_engine,
            ));
            app.manage(workflow_engine);

            // Register SessionManager as managed state
            app.manage(session_manager);

            // Lifecycle listeners: update specs and advance workflows on agent status changes
            let spec_mgr = Arc::clone(&spec_manager);
            let wf_engine = app.state::<Arc<WorkflowEngine>>().inner().clone();
            let app_for_events = app.handle().clone();
            app.listen("agent:status-changed", move |event| {
                if let Ok(status_event) = serde_json::from_str::<domain::ports::StatusChangedEvent>(event.payload()) {
                    let sm = Arc::clone(&spec_mgr);
                    let we = Arc::clone(&wf_engine);
                    let app_h = app_for_events.clone();
                    tauri::async_runtime::spawn(async move {
                        // Spec lifecycle
                        let spec_change = match status_event.status {
                            domain::models::AgentStatus::Running => {
                                sm.on_agent_started(&status_event.session_id).await
                            }
                            domain::models::AgentStatus::Completed => {
                                sm.on_agent_completed(&status_event.session_id).await
                            }
                            _ => None,
                        };
                        if let Some(spec) = spec_change {
                            let _ = app_h.emit("spec:status-changed", SpecStatusChangedPayload {
                                file_path: spec.file_path,
                                status: spec.status.to_string(),
                            });
                        }

                        // Workflow lifecycle
                        match status_event.status {
                            domain::models::AgentStatus::Completed => {
                                we.on_agent_completed(&status_event.session_id).await;
                            }
                            domain::models::AgentStatus::Error => {
                                we.on_agent_failed(&status_event.session_id).await;
                            }
                            _ => {}
                        }
                    });
                }
            });

            Ok(())
        })
        .manage(log_repo as Arc<dyn LogRepository>)
        .manage(config_store)
        .manage(config_state)
        .manage(spec_manager_for_state)
        .manage(workflow_repo_for_state)
        .invoke_handler(tauri::generate_handler![
            agent_commands::start_agent,
            agent_commands::stop_agent,
            agent_commands::resume_agent,
            agent_commands::list_sessions,
            agent_commands::get_session,
            agent_commands::list_agents,
            agent_commands::set_project_dir,
            agent_commands::get_project_dir,
            agent_commands::check_claude_auth,
            agent_commands::open_claude_login,
            log_commands::get_session_logs,
            log_commands::get_session_log_count,
            config_commands::get_config,
            config_commands::save_config,
            config_commands::set_project_path,
            config_commands::get_project_path,
            config_commands::check_agent_approval,
            config_commands::approve_agents,
            spec_commands::list_specs,
            spec_commands::get_spec,
            spec_commands::create_spec,
            spec_commands::update_spec,
            spec_commands::delete_spec,
            spec_commands::run_spec,
            workflow_commands::create_workflow,
            workflow_commands::get_workflow,
            workflow_commands::list_workflows,
            workflow_commands::delete_workflow,
            workflow_commands::add_workflow_step,
            workflow_commands::update_workflow_step,
            workflow_commands::remove_workflow_step,
            workflow_commands::get_workflow_steps,
            workflow_commands::add_workflow_edge,
            workflow_commands::remove_workflow_edge,
            workflow_commands::get_workflow_edges,
            workflow_commands::start_workflow,
            workflow_commands::stop_workflow,
            workflow_commands::validate_workflow,
            review_commands::get_changed_files,
            review_commands::get_diff,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                // Graceful shutdown: stop all running agents
                if let Some(sm) = app.try_state::<Arc<SessionManager>>() {
                    let sm = Arc::clone(&*sm);
                    tauri::async_runtime::block_on(async {
                        sm.shutdown_all().await;
                    });
                }
            }
        });
}
