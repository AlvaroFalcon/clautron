use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Event emitted when agent config files change on disk.
#[derive(Clone, serde::Serialize)]
pub struct AgentConfigChangedEvent {
    /// Files that were added or modified.
    pub changed_files: Vec<String>,
}

#[derive(Clone, serde::Serialize)]
pub struct UnapprovedAgent {
    pub file_path: String,
    pub name: String,
    pub model: String,
    pub description: String,
    pub hash: String,
}

/// Compute SHA-256 hash of file contents.
pub fn hash_file(path: &std::path::Path) -> Option<String> {
    let content = std::fs::read(path).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(&content);
    Some(hex::encode(hasher.finalize()))
}

/// Recursively collect all `.md` files under a directory.
pub fn collect_md_files(dir: &std::path::Path) -> Vec<PathBuf> {
    let mut results = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                results.extend(collect_md_files(&path));
            } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
                results.push(path);
            }
        }
    }
    results
}

/// Start watching .claude/agents/ directory for changes.
/// Debounced at 500ms. Emits `agents:config-changed` on file changes.
pub fn start_watching(app: AppHandle, agents_dir: PathBuf) -> Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>> {
    if !agents_dir.exists() {
        return None;
    }

    let app_handle = app.clone();
    let watch_dir = agents_dir.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        move |events: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            if let Ok(events) = events {
                let changed: Vec<String> = events
                    .iter()
                    .filter(|e| e.kind == DebouncedEventKind::Any)
                    .filter_map(|e| {
                        let path = &e.path;
                        if path.extension().and_then(|e| e.to_str()) == Some("md") {
                            Some(path.to_string_lossy().to_string())
                        } else {
                            None
                        }
                    })
                    .collect();

                if !changed.is_empty() {
                    let _ = app_handle.emit(
                        "agents:config-changed",
                        AgentConfigChangedEvent {
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
        .watch(&watch_dir, notify::RecursiveMode::Recursive)
        .ok()?;

    Some(debouncer)
}
