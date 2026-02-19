use crate::services::quota_service::{poll_once, QuotaState};
use std::sync::Arc;
use tauri::AppHandle;

/// Manually trigger a quota refresh. The result is pushed via the
/// `quota:update` event rather than returned directly.
#[tauri::command]
pub async fn refresh_quota(
    app: AppHandle,
    state: tauri::State<'_, Arc<QuotaState>>,
) -> Result<(), String> {
    poll_once(&app, &state).await;
    Ok(())
}
