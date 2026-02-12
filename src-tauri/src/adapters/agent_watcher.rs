// Re-export from services — agent_watcher stays as-is (no trait needed)
pub use crate::services::agent_watcher::{
    collect_md_files, hash_file, start_watching, AgentConfigChangedEvent, UnapprovedAgent,
};
