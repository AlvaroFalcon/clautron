//! Reads Claude Code's local stats cache and emits `quota:update` events.
//!
//! Instead of polling a private OAuth endpoint (which requires Keychain access
//! and is undocumented), we read `~/.claude/stats-cache.json` — a local file
//! that Claude Code maintains itself after every session. It contains per-model
//! token counts, USD cost, and daily activity. No network, no auth required.
//!
//! The file is re-read every 60 seconds and on explicit refresh requests.

use chrono::Local;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{async_runtime, AppHandle, Emitter};
use tokio::sync::RwLock;

const POLL_INTERVAL_SECS: u64 = 60;

// ---------------------------------------------------------------------------
// stats-cache.json types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StatsCache {
    #[serde(default)]
    model_usage: HashMap<String, ModelStats>,
    #[serde(default)]
    daily_activity: Vec<DailyActivity>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ModelStats {
    #[serde(default)]
    input_tokens: u64,
    #[serde(default)]
    output_tokens: u64,
    #[serde(default)]
    cache_read_input_tokens: u64,
    #[serde(default)]
    cache_creation_input_tokens: u64,
    #[serde(default)]
    cost_usd: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DailyActivity {
    date: String, // "YYYY-MM-DD"
    #[serde(default)]
    session_count: u32,
    #[serde(default)]
    message_count: u32,
    #[serde(default)]
    tool_call_count: u32,
}

// ---------------------------------------------------------------------------
// Public output types (serialized and sent to the frontend)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct ModelUsageEntry {
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_creation_tokens: u64,
    pub cost_usd: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailyStats {
    pub date: String,
    pub session_count: u32,
    pub message_count: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct QuotaUpdateEvent {
    /// Per-model breakdown across all time.
    pub models: Vec<ModelUsageEntry>,
    /// Today's activity stats.
    pub today: Option<DailyStats>,
    /// Total all-time cost in USD.
    pub total_cost_usd: f64,
    pub fetched_at: String,
    /// False when the stats file could not be read.
    pub available: bool,
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

pub struct QuotaState {
    _private: RwLock<()>,
}

impl QuotaState {
    pub fn new() -> Self {
        Self {
            _private: RwLock::new(()),
        }
    }
}

// ---------------------------------------------------------------------------
// File reading
// ---------------------------------------------------------------------------

fn stats_cache_path() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("stats-cache.json"))
}

fn read_stats() -> Result<QuotaUpdateEvent, String> {
    let path = stats_cache_path().ok_or("Cannot determine home directory")?;
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read stats-cache.json: {e}"))?;
    let cache: StatsCache =
        serde_json::from_str(&content).map_err(|e| format!("Cannot parse stats-cache.json: {e}"))?;

    let today_str = Local::now().format("%Y-%m-%d").to_string();

    let today = cache.daily_activity.iter().find(|d| d.date == today_str).map(|d| DailyStats {
        date: d.date.clone(),
        session_count: d.session_count,
        message_count: d.message_count,
    });

    let mut models: Vec<ModelUsageEntry> = cache
        .model_usage
        .into_iter()
        .map(|(model, stats)| ModelUsageEntry {
            model,
            input_tokens: stats.input_tokens,
            output_tokens: stats.output_tokens,
            cache_read_tokens: stats.cache_read_input_tokens,
            cache_creation_tokens: stats.cache_creation_input_tokens,
            cost_usd: stats.cost_usd,
        })
        .collect();

    // Sort by cost descending so the most-used model appears first
    models.sort_by(|a, b| b.cost_usd.partial_cmp(&a.cost_usd).unwrap_or(std::cmp::Ordering::Equal));

    let total_cost_usd = models.iter().map(|m| m.cost_usd).sum();

    Ok(QuotaUpdateEvent {
        models,
        today,
        total_cost_usd,
        fetched_at: chrono::Utc::now().to_rfc3339(),
        available: true,
        error: None,
    })
}

fn emit_unavailable(app: &AppHandle, reason: &str) {
    let _ = app.emit(
        "quota:update",
        QuotaUpdateEvent {
            models: vec![],
            today: None,
            total_cost_usd: 0.0,
            fetched_at: chrono::Utc::now().to_rfc3339(),
            available: false,
            error: Some(reason.to_string()),
        },
    );
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

pub fn start_poller(app: AppHandle, _state: Arc<QuotaState>) {
    async_runtime::spawn(async move {
        loop {
            poll_once_inner(&app);
            tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_SECS)).await;
        }
    });
}

pub async fn poll_once(app: &AppHandle, _state: &QuotaState) {
    poll_once_inner(app);
}

fn poll_once_inner(app: &AppHandle) {
    match read_stats() {
        Ok(event) => {
            let _ = app.emit("quota:update", event);
        }
        Err(e) => {
            emit_unavailable(app, &e);
        }
    }
}
