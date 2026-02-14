use crate::domain::error::DomainError;
use crate::domain::models::*;
use crate::domain::ports::WorkflowRepository;
use crate::domain::session_manager::SessionManager;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

/// Workflow execution engine. Resolves DAG dependencies and launches
/// agent steps in the correct order (parallel when possible).
pub struct WorkflowEngine {
    repo: Arc<dyn WorkflowRepository>,
    session_manager: Arc<SessionManager>,
}

impl WorkflowEngine {
    pub fn new(
        repo: Arc<dyn WorkflowRepository>,
        session_manager: Arc<SessionManager>,
    ) -> Self {
        Self {
            repo,
            session_manager,
        }
    }

    /// Validate a workflow DAG: check for cycles via topological sort.
    pub async fn validate(&self, workflow_id: &str) -> Result<(), DomainError> {
        let steps = self.repo.get_steps(workflow_id).await?;
        let edges = self.repo.get_edges(workflow_id).await?;

        if steps.is_empty() {
            return Err(DomainError::Process("Workflow has no steps".into()));
        }

        // Build adjacency list and in-degree map
        let mut in_degree: HashMap<String, usize> = HashMap::new();
        let mut adj: HashMap<String, Vec<String>> = HashMap::new();

        for step in &steps {
            in_degree.entry(step.id.clone()).or_insert(0);
            adj.entry(step.id.clone()).or_default();
        }

        for edge in &edges {
            *in_degree.entry(edge.target_step_id.clone()).or_insert(0) += 1;
            adj.entry(edge.source_step_id.clone())
                .or_default()
                .push(edge.target_step_id.clone());
        }

        // Kahn's algorithm
        let mut queue: Vec<String> = in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(id, _)| id.clone())
            .collect();

        let mut visited = 0;
        while let Some(node) = queue.pop() {
            visited += 1;
            if let Some(neighbors) = adj.get(&node) {
                for next in neighbors {
                    if let Some(deg) = in_degree.get_mut(next) {
                        *deg -= 1;
                        if *deg == 0 {
                            queue.push(next.clone());
                        }
                    }
                }
            }
        }

        if visited != steps.len() {
            return Err(DomainError::Process(
                "Workflow contains a cycle".into(),
            ));
        }

        Ok(())
    }

    /// Start executing a workflow.
    pub async fn start(&self, workflow_id: &str) -> Result<(), DomainError> {
        self.validate(workflow_id).await?;

        self.repo
            .update_workflow_status(workflow_id, WorkflowStatus::Running)
            .await?;

        // Find initially unblocked steps and start them
        self.advance(workflow_id).await?;

        Ok(())
    }

    /// Stop a running workflow.
    pub async fn stop(&self, workflow_id: &str) -> Result<(), DomainError> {
        let steps = self.repo.get_steps(workflow_id).await?;

        // Kill running steps
        for step in &steps {
            if step.status == StepStatus::Running {
                if let Some(ref sid) = step.session_id {
                    let _ = self.session_manager.stop_agent(sid).await;
                }
                self.repo
                    .update_step_status(&step.id, StepStatus::Skipped, None)
                    .await?;
            } else if step.status == StepStatus::Pending {
                self.repo
                    .update_step_status(&step.id, StepStatus::Skipped, None)
                    .await?;
            }
        }

        self.repo
            .update_workflow_status(workflow_id, WorkflowStatus::Cancelled)
            .await?;

        Ok(())
    }

    /// Called when an agent session completes. Maps session_id -> workflow step,
    /// updates step status, and advances the workflow.
    pub async fn on_agent_completed(&self, session_id: &str) -> Option<String> {
        // Find which workflow step this session belongs to
        let workflows = self.repo.list_workflows().await.ok()?;
        for wf in &workflows {
            if wf.status != WorkflowStatus::Running {
                continue;
            }
            let steps = self.repo.get_steps(&wf.id).await.ok()?;
            for step in &steps {
                if step.session_id.as_deref() == Some(session_id)
                    && step.status == StepStatus::Running
                {
                    let _ = self
                        .repo
                        .update_step_status(&step.id, StepStatus::Completed, None)
                        .await;
                    let _ = self.advance(&wf.id).await;
                    return Some(wf.id.clone());
                }
            }
        }
        None
    }

    /// Called when an agent session fails.
    pub async fn on_agent_failed(&self, session_id: &str) -> Option<String> {
        let workflows = self.repo.list_workflows().await.ok()?;
        for wf in &workflows {
            if wf.status != WorkflowStatus::Running {
                continue;
            }
            let steps = self.repo.get_steps(&wf.id).await.ok()?;
            for step in &steps {
                if step.session_id.as_deref() == Some(session_id)
                    && step.status == StepStatus::Running
                {
                    let _ = self
                        .repo
                        .update_step_status(&step.id, StepStatus::Failed, None)
                        .await;
                    // Mark workflow as failed
                    let _ = self
                        .repo
                        .update_workflow_status(&wf.id, WorkflowStatus::Failed)
                        .await;
                    return Some(wf.id.clone());
                }
            }
        }
        None
    }

    /// Advance the workflow: find unblocked pending steps and start them.
    async fn advance(&self, workflow_id: &str) -> Result<(), DomainError> {
        let steps = self.repo.get_steps(workflow_id).await?;
        let edges = self.repo.get_edges(workflow_id).await?;

        // Build set of completed step IDs
        let completed: HashSet<String> = steps
            .iter()
            .filter(|s| s.status == StepStatus::Completed)
            .map(|s| s.id.clone())
            .collect();

        // Find pending steps whose dependencies are all completed
        let mut started_any = false;
        for step in &steps {
            if step.status != StepStatus::Pending {
                continue;
            }

            let deps: Vec<&WorkflowEdge> = edges
                .iter()
                .filter(|e| e.target_step_id == step.id)
                .collect();

            let all_deps_met = deps
                .iter()
                .all(|e| completed.contains(&e.source_step_id));

            if all_deps_met {
                // Start this step
                match self
                    .session_manager
                    .start_agent(
                        step.agent_name.clone(),
                        step.model.clone(),
                        step.prompt.clone(),
                    )
                    .await
                {
                    Ok(session_id) => {
                        self.repo
                            .update_step_status(
                                &step.id,
                                StepStatus::Running,
                                Some(session_id),
                            )
                            .await?;
                        started_any = true;
                    }
                    Err(e) => {
                        eprintln!("Failed to start workflow step {}: {}", step.id, e);
                        self.repo
                            .update_step_status(&step.id, StepStatus::Failed, None)
                            .await?;
                        self.repo
                            .update_workflow_status(workflow_id, WorkflowStatus::Failed)
                            .await?;
                        return Ok(());
                    }
                }
            }
        }

        // Check if workflow is complete (all steps completed)
        if !started_any {
            let all_done = steps
                .iter()
                .all(|s| s.status == StepStatus::Completed);
            if all_done && !steps.is_empty() {
                self.repo
                    .update_workflow_status(workflow_id, WorkflowStatus::Completed)
                    .await?;
            }
        }

        Ok(())
    }
}
