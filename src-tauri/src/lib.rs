pub mod adapters;
mod commands;
pub mod domain;
mod error;

use adapters::claude_cli_runner::ClaudeCliRunner;
use adapters::in_memory_session_repository::InMemorySessionRepository;
use adapters::sqlite_log_repository::SqliteLogRepository;
use adapters::tauri_event_emitter::TauriEventEmitter;
use commands::{agent_commands, config_commands, log_commands};
use domain::ports::LogRepository;
use domain::session_manager::SessionManager;
use services::agent_watcher;
use services::config_store::ConfigStore;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;

// Keep services module for config_store and agent_watcher (no trait needed)
mod services;

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
    let session_repo_for_state = Arc::clone(&session_repo);

    // Restore project dir from saved config
    let project_path_for_setup = config.project_path.clone();

    let config_state: config_commands::ConfigState = Arc::new(RwLock::new(config));

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

            // Start FS watcher for .claude/agents/ if project is configured
            let sm_for_watcher = Arc::clone(&session_manager);
            tauri::async_runtime::spawn(async move {
                if let Some(project_dir) = sm_for_watcher.get_project_dir().await {
                    let agents_dir =
                        std::path::PathBuf::from(&project_dir).join(".claude/agents");
                    if let Some(watcher) =
                        agent_watcher::start_watching(app_handle, agents_dir)
                    {
                        // Keep watcher alive by leaking it — it lives for app lifetime
                        std::mem::forget(watcher);
                    }
                }
            });

            // Register SessionManager as managed state
            app.manage(session_manager);

            Ok(())
        })
        .manage(log_repo as Arc<dyn LogRepository>)
        .manage(config_store)
        .manage(config_state)
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
