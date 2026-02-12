use crate::domain::error::DomainError;
use crate::domain::models::LogEntry;
use crate::domain::ports::LogRepository;
use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::Mutex;

/// A buffered log entry for internal storage before flush.
struct BufferedEntry {
    session_id: String,
    message_type: String,
    content: String,
    timestamp: String,
}

const BATCH_THRESHOLD: usize = 100;

/// LogRepository adapter backed by SQLite.
pub struct SqliteLogRepository {
    db_path: String,
    buffer: Arc<Mutex<Vec<BufferedEntry>>>,
}

impl SqliteLogRepository {
    pub fn new(db_path: String) -> Self {
        Self {
            db_path,
            buffer: Arc::new(Mutex::new(Vec::new())),
        }
    }

    async fn connect(&self) -> Result<sqlx::SqlitePool, DomainError> {
        let url = format!("sqlite:{}?mode=rwc", self.db_path);
        sqlx::SqlitePool::connect(&url)
            .await
            .map_err(|e| DomainError::Database(e.to_string()))
    }
}

#[async_trait]
impl LogRepository for SqliteLogRepository {
    async fn append(
        &self,
        session_id: &str,
        message_type: &str,
        content: &str,
        timestamp: &str,
    ) {
        let mut buf = self.buffer.lock().await;
        buf.push(BufferedEntry {
            session_id: session_id.to_string(),
            message_type: message_type.to_string(),
            content: content.to_string(),
            timestamp: timestamp.to_string(),
        });
        if buf.len() >= BATCH_THRESHOLD {
            let batch: Vec<BufferedEntry> = buf.drain(..).collect();
            let db_path = self.db_path.clone();
            tokio::spawn(async move {
                if let Err(e) = flush_batch(&db_path, &batch).await {
                    eprintln!("Log flush error: {e}");
                }
            });
        }
    }

    async fn flush(&self) {
        let mut buf = self.buffer.lock().await;
        if buf.is_empty() {
            return;
        }
        let batch: Vec<BufferedEntry> = buf.drain(..).collect();
        let db_path = self.db_path.clone();
        tokio::spawn(async move {
            if let Err(e) = flush_batch(&db_path, &batch).await {
                eprintln!("Log flush error: {e}");
            }
        });
    }

    async fn query_logs(
        &self,
        session_id: &str,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<LogEntry>, DomainError> {
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
        .map_err(|e| DomainError::Database(e.to_string()))?;

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

    async fn count_logs(&self, session_id: &str) -> Result<u64, DomainError> {
        let db = self.connect().await?;
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM log_entries WHERE session_id = ?")
                .bind(session_id)
                .fetch_one(&db)
                .await
                .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(row.0 as u64)
    }
}

// Infrastructure lifecycle methods — not part of the domain port.
impl SqliteLogRepository {
    /// Initialize the SQLite database and run migrations.
    pub async fn init(&self) -> Result<(), DomainError> {
        let db = self.connect().await?;
        let migration = include_str!("../../migrations/001_initial.sql");
        for statement in migration.split(';') {
            let stmt = statement.trim();
            if stmt.is_empty() {
                continue;
            }
            sqlx::query(stmt)
                .execute(&db)
                .await
                .map_err(|e| DomainError::Database(format!("{e}: {stmt}")))?;
        }
        db.close().await;
        Ok(())
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

#[derive(sqlx::FromRow)]
struct LogEntryRow {
    id: i64,
    session_id: String,
    message_type: String,
    content: String,
    timestamp: String,
}

async fn flush_batch(db_path: &str, batch: &[BufferedEntry]) -> Result<(), DomainError> {
    let url = format!("sqlite:{}?mode=rwc", db_path);
    let db = sqlx::SqlitePool::connect(&url)
        .await
        .map_err(|e| DomainError::Database(e.to_string()))?;

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
        .map_err(|e| DomainError::Database(e.to_string()))?;
    }

    db.close().await;
    Ok(())
}
