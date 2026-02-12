mod commands;
mod error;
mod models;
mod services;

use commands::{agent_commands, config_commands, log_commands};
use services::agent_watcher;
use services::config_store::ConfigStore;
use services::log_store::LogStore;
use services::process_manager::ProcessManager;
use std::sync::Arc;
use tokio::sync::RwLock;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let process_manager = Arc::new(ProcessManager::new());

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

    // Log store (SQLite)
    let db_file = data_dir.join("data.db").to_string_lossy().to_string();
    let log_store = Arc::new(LogStore::new(db_file));
    process_manager.set_log_store(Arc::clone(&log_store));

    // Config store (JSON)
    let config_store = Arc::new(ConfigStore::new());
    let config = config_store.load();

    // Restore project dir from saved config
    if let Some(ref project_path) = config.project_path {
        let pm = Arc::clone(&process_manager);
        let path = project_path.clone();
        tauri::async_runtime::spawn(async move {
            pm.set_project_dir(path).await;
        });
    }

    let config_state: config_commands::ConfigState = Arc::new(RwLock::new(config));

    // Clone references for setup closure and shutdown
    let log_store_for_setup = Arc::clone(&log_store);
    let pm_for_watcher = Arc::clone(&process_manager);
    let pm_for_shutdown = Arc::clone(&process_manager);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            // Initialize SQLite and start periodic flush
            let ls = Arc::clone(&log_store_for_setup);
            tauri::async_runtime::spawn(async move {
                if let Err(e) = ls.init().await {
                    eprintln!("Failed to init log store: {e}");
                }
                ls.start_flush_task();
            });

            // Start FS watcher for .claude/agents/ if project is configured
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Some(project_dir) = pm_for_watcher.get_project_dir().await {
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

            Ok(())
        })
        .manage(process_manager)
        .manage(log_store)
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
        .run(move |_app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                // Graceful shutdown: stop all running agents
                tauri::async_runtime::block_on(async {
                    pm_for_shutdown.shutdown_all().await;
                });
            }
        });
}
