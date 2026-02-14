use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Event emitted when spec files change on disk.
#[derive(Clone, serde::Serialize)]
pub struct SpecsChangedEvent {
    pub changed_files: Vec<String>,
}

/// Start watching specs/ directory for changes.
/// Debounced at 500ms. Emits `specs:changed` on file changes.
pub fn start_watching(
    app: AppHandle,
    specs_dir: PathBuf,
) -> Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>> {
    if !specs_dir.exists() {
        // Create specs dir so the watcher has something to watch
        let _ = std::fs::create_dir_all(&specs_dir);
    }

    let app_handle = app.clone();
    let watch_dir = specs_dir.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        move |events: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            if let Ok(events) = events {
                let changed: Vec<String> = events
                    .iter()
                    .filter(|e| e.kind == DebouncedEventKind::Any)
                    .filter_map(|e| {
                        let path = &e.path;
                        if path.extension().and_then(|ext| ext.to_str()) == Some("md") {
                            Some(path.to_string_lossy().to_string())
                        } else {
                            None
                        }
                    })
                    .collect();

                if !changed.is_empty() {
                    let _ = app_handle.emit(
                        "specs:changed",
                        SpecsChangedEvent {
                            changed_files: changed,
                        },
                    );
                }
            }
        },
    )
    .ok()?;

    debouncer
        .watcher()
        .watch(&watch_dir, notify::RecursiveMode::NonRecursive)
        .ok()?;

    Some(debouncer)
}
