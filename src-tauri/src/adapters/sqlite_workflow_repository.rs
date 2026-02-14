use crate::domain::error::DomainError;
use crate::domain::models::*;
use crate::domain::ports::WorkflowRepository;
use async_trait::async_trait;

pub struct SqliteWorkflowRepository {
    db_path: String,
}

impl SqliteWorkflowRepository {
    pub fn new(db_path: String) -> Self {
        Self { db_path }
    }

    async fn connect(&self) -> Result<sqlx::SqlitePool, DomainError> {
        let url = format!("sqlite:{}?mode=rwc", self.db_path);
        sqlx::SqlitePool::connect(&url)
            .await
            .map_err(|e| DomainError::Database(e.to_string()))
    }
}

#[async_trait]
impl WorkflowRepository for SqliteWorkflowRepository {
    async fn save_workflow(&self, w: &Workflow) -> Result<(), DomainError> {
        let db = self.connect().await?;
        sqlx::query(
            "INSERT INTO workflows (id, name, description, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&w.id)
        .bind(&w.name)
        .bind(&w.description)
        .bind(w.status.to_string())
        .bind(&w.created_at)
        .bind(&w.updated_at)
        .execute(&db)
        .await
        .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(())
    }

    async fn get_workflow(&self, id: &str) -> Result<Option<Workflow>, DomainError> {
        let db = self.connect().await?;
        let row = sqlx::query_as::<_, (String, String, Option<String>, String, String, String)>(
            "SELECT id, name, description, status, created_at, updated_at FROM workflows WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&db)
        .await
        .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(row.map(|r| Workflow {
            id: r.0,
            name: r.1,
            description: r.2,
            status: parse_workflow_status(&r.3),
            created_at: r.4,
            updated_at: r.5,
        }))
    }

    async fn list_workflows(&self) -> Result<Vec<Workflow>, DomainError> {
        let db = self.connect().await?;
        let rows = sqlx::query_as::<_, (String, String, Option<String>, String, String, String)>(
            "SELECT id, name, description, status, created_at, updated_at FROM workflows ORDER BY updated_at DESC",
        )
        .fetch_all(&db)
        .await
        .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(rows
            .into_iter()
            .map(|r| Workflow {
                id: r.0,
                name: r.1,
                description: r.2,
                status: parse_workflow_status(&r.3),
                created_at: r.4,
                updated_at: r.5,
            })
            .collect())
    }

    async fn update_workflow_status(
        &self,
        id: &str,
        status: WorkflowStatus,
    ) -> Result<(), DomainError> {
        let db = self.connect().await?;
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("UPDATE workflows SET status = ?, updated_at = ? WHERE id = ?")
            .bind(status.to_string())
            .bind(&now)
            .bind(id)
            .execute(&db)
            .await
            .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(())
    }

    async fn delete_workflow(&self, id: &str) -> Result<(), DomainError> {
        let db = self.connect().await?;
        sqlx::query("DELETE FROM workflows WHERE id = ?")
            .bind(id)
            .execute(&db)
            .await
            .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(())
    }

    async fn save_step(&self, s: &WorkflowStep) -> Result<(), DomainError> {
        let db = self.connect().await?;
        sqlx::query(
            "INSERT INTO workflow_steps (id, workflow_id, agent_name, model, prompt, spec_path, status, session_id, position_x, position_y, created_at, pass_context, result_output)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&s.id)
        .bind(&s.workflow_id)
        .bind(&s.agent_name)
        .bind(&s.model)
        .bind(&s.prompt)
        .bind(&s.spec_path)
        .bind(s.status.to_string())
        .bind(&s.session_id)
        .bind(s.position_x)
        .bind(s.position_y)
        .bind(&s.created_at)
        .bind(s.pass_context)
        .bind(&s.result_output)
        .execute(&db)
        .await
        .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(())
    }

    async fn update_step_status(
        &self,
        id: &str,
        status: StepStatus,
        session_id: Option<String>,
    ) -> Result<(), DomainError> {
        let db = self.connect().await?;
        sqlx::query("UPDATE workflow_steps SET status = ?, session_id = COALESCE(?, session_id) WHERE id = ?")
            .bind(status.to_string())
            .bind(&session_id)
            .bind(id)
            .execute(&db)
            .await
            .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(())
    }

    async fn get_steps(&self, workflow_id: &str) -> Result<Vec<WorkflowStep>, DomainError> {
        let db = self.connect().await?;
        let rows = sqlx::query_as::<_, (String, String, String, String, String, Option<String>, String, Option<String>, f64, f64, String, i32, Option<String>)>(
            "SELECT id, workflow_id, agent_name, model, prompt, spec_path, status, session_id, position_x, position_y, created_at, pass_context, result_output FROM workflow_steps WHERE workflow_id = ?",
        )
        .bind(workflow_id)
        .fetch_all(&db)
        .await
        .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(rows
            .into_iter()
            .map(|r| WorkflowStep {
                id: r.0,
                workflow_id: r.1,
                agent_name: r.2,
                model: r.3,
                prompt: r.4,
                spec_path: r.5,
                status: parse_step_status(&r.6),
                session_id: r.7,
                position_x: r.8,
                position_y: r.9,
                created_at: r.10,
                pass_context: r.11 != 0,
                result_output: r.12,
            })
            .collect())
    }

    async fn update_step(&self, s: &WorkflowStep) -> Result<(), DomainError> {
        let db = self.connect().await?;
        sqlx::query(
            "UPDATE workflow_steps SET agent_name = ?, model = ?, prompt = ?, spec_path = ?, position_x = ?, position_y = ?, pass_context = ? WHERE id = ?",
        )
        .bind(&s.agent_name)
        .bind(&s.model)
        .bind(&s.prompt)
        .bind(&s.spec_path)
        .bind(s.position_x)
        .bind(s.position_y)
        .bind(s.pass_context)
        .bind(&s.id)
        .execute(&db)
        .await
        .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(())
    }

    async fn update_step_result(&self, id: &str, result_output: &str) -> Result<(), DomainError> {
        let db = self.connect().await?;
        sqlx::query("UPDATE workflow_steps SET result_output = ? WHERE id = ?")
            .bind(result_output)
            .bind(id)
            .execute(&db)
            .await
            .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(())
    }

    async fn delete_step(&self, id: &str) -> Result<(), DomainError> {
        let db = self.connect().await?;
        sqlx::query("DELETE FROM workflow_steps WHERE id = ?")
            .bind(id)
            .execute(&db)
            .await
            .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(())
    }

    async fn save_edge(&self, e: &WorkflowEdge) -> Result<(), DomainError> {
        let db = self.connect().await?;
        sqlx::query(
            "INSERT INTO workflow_edges (id, workflow_id, source_step_id, target_step_id)
             VALUES (?, ?, ?, ?)",
        )
        .bind(&e.id)
        .bind(&e.workflow_id)
        .bind(&e.source_step_id)
        .bind(&e.target_step_id)
        .execute(&db)
        .await
        .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(())
    }

    async fn get_edges(&self, workflow_id: &str) -> Result<Vec<WorkflowEdge>, DomainError> {
        let db = self.connect().await?;
        let rows = sqlx::query_as::<_, (String, String, String, String)>(
            "SELECT id, workflow_id, source_step_id, target_step_id FROM workflow_edges WHERE workflow_id = ?",
        )
        .bind(workflow_id)
        .fetch_all(&db)
        .await
        .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(rows
            .into_iter()
            .map(|r| WorkflowEdge {
                id: r.0,
                workflow_id: r.1,
                source_step_id: r.2,
                target_step_id: r.3,
            })
            .collect())
    }

    async fn delete_edge(&self, id: &str) -> Result<(), DomainError> {
        let db = self.connect().await?;
        sqlx::query("DELETE FROM workflow_edges WHERE id = ?")
            .bind(id)
            .execute(&db)
            .await
            .map_err(|e| DomainError::Database(e.to_string()))?;
        db.close().await;
        Ok(())
    }
}

fn parse_workflow_status(s: &str) -> WorkflowStatus {
    match s {
        "ready" => WorkflowStatus::Ready,
        "running" => WorkflowStatus::Running,
        "completed" => WorkflowStatus::Completed,
        "failed" => WorkflowStatus::Failed,
        "cancelled" => WorkflowStatus::Cancelled,
        _ => WorkflowStatus::Draft,
    }
}

fn parse_step_status(s: &str) -> StepStatus {
    match s {
        "running" => StepStatus::Running,
        "completed" => StepStatus::Completed,
        "failed" => StepStatus::Failed,
        "skipped" => StepStatus::Skipped,
        _ => StepStatus::Pending,
    }
}
