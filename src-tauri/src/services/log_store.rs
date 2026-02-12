use crate::error::AppError;
use crate::models::session::LogEntry;
use crate::services::process_manager::AgentMessageEvent;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Batched log writer for SQLite persistence.
/// Accumulates log entries and flushes them periodically or when a batch threshold is reached.
pub struct LogStore {
    db_path: String,
    buffer: Arc<Mutex<Vec<AgentMessageEvent>>>,
}

const BATCH_THRESHOLD: usize = 100;

impl LogStore {
    pub fn new(db_path: String) -> Self {
        Self {
            db_path,
            buffer: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Initialize the SQLite database and run migrations.
    pub async fn init(&self) -> Result<(), AppError> {
        let db = self.connect().await?;
        // Run the initial migration -- execute each statement separately
        let migration = include_str!("../../migrations/001_initial.sql");
        for statement in migration.split(';') {
            let stmt = statement.trim();
            if stmt.is_empty() {
                continue;
            }
            sqlx::query(stmt)
                .execute(&db)
                .await
                .map_err(|e| AppError::Database(format!("{e}: {stmt}")))?;
        }
        db.close().await;
        Ok(())
    }

    async fn connect(&self) -> Result<sqlx::SqlitePool, AppError> {
        let url = format!("sqlite:{}?mode=rwc", self.db_path);
        sqlx::SqlitePool::connect(&url)
            .await
            .map_err(|e| AppError::Database(e.to_string()))
    }

    /// Buffer a log entry. Flushes to disk when the batch threshold is reached.
    pub async fn append(&self, event: AgentMessageEvent) {
        let mut buf = self.buffer.lock().await;
        buf.push(event);
        if buf.len() >= BATCH_THRESHOLD {
            let batch: Vec<AgentMessageEvent> = buf.drain(..).collect();
            let db_path = self.db_path.clone();
            // Spawn a task to flush without blocking the caller
            tokio::spawn(async move {
                if let Err(e) = flush_batch(&db_path, &batch).await {
                    eprintln!("Log flush error: {e}");
                }
            });
        }
    }

    /// Force-flush any remaining buffered entries.
    pub async fn flush(&self) {
        let mut buf = self.buffer.lock().await;
        if buf.is_empty() {
            return;
        }
        let batch: Vec<AgentMessageEvent> = buf.drain(..).collect();
        let db_path = self.db_path.clone();
        tokio::spawn(async move {
            if let Err(e) = flush_batch(&db_path, &batch).await {
                eprintln!("Log flush error: {e}");
            }
        });
    }

    /// Query logs for a session with pagination.
    pub async fn get_session_logs(
        &self,
        session_id: &str,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<LogEntry>, AppError> {
        let db = self.connect().await?;
        let rows = sqlx::query_as::<_, LogEntryRow>(
            "SELECT id, session_id, message_type, content, timestamp
             FROM log_entries
             WHERE session_id = ?
             ORDER BY id ASC
             LIMIT ? OFFSET ?",
        )
        .bind(session_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&db)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

        db.close().await;

        Ok(rows
            .into_iter()
            .map(|r| LogEntry {
                id: r.id as u64,
                session_id: r.session_id,
                message_type: r.message_type,
                content: r.content,
                timestamp: r.timestamp,
            })
            .collect())
    }

    /// Get total log count for a session.
    pub async fn get_session_log_count(&self, session_id: &str) -> Result<u64, AppError> {
        let db = self.connect().await?;
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM log_entries WHERE session_id = ?",
        )
        .bind(session_id)
        .fetch_one(&db)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
        db.close().await;
        Ok(row.0 as u64)
    }

    /// Start a periodic flush task that runs every 500ms.
    pub fn start_flush_task(self: &Arc<Self>) {
        let store = Arc::clone(self);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));
            loop {
                interval.tick().await;
                store.flush().await;
            }
        });
    }
}

/// SQLite row type for query_as
#[derive(sqlx::FromRow)]
struct LogEntryRow {
    id: i64,
    session_id: String,
    message_type: String,
    content: String,
    timestamp: String,
}

/// Flush a batch of log entries to SQLite.
async fn flush_batch(db_path: &str, batch: &[AgentMessageEvent]) -> Result<(), AppError> {
    let url = format!("sqlite:{}?mode=rwc", db_path);
    let db = sqlx::SqlitePool::connect(&url)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    for entry in batch {
        sqlx::query(
            "INSERT INTO log_entries (session_id, message_type, content, timestamp)
             VALUES (?, ?, ?, ?)",
        )
        .bind(&entry.session_id)
        .bind(&entry.message_type)
        .bind(&entry.content)
        .bind(&entry.timestamp)
        .execute(&db)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    db.close().await;
    Ok(())
}
