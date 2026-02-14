use crate::domain::error::DomainError;
use crate::domain::models::*;
use crate::domain::ports::{LogRepository, WorkflowRepository};
use crate::domain::session_manager::SessionManager;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

/// Max size for captured result output (50KB) to prevent context explosion.
const MAX_RESULT_OUTPUT_LEN: usize = 50 * 1024;

/// Workflow execution engine. Resolves DAG dependencies and launches
/// agent steps in the correct order (parallel when possible).
pub struct WorkflowEngine {
    repo: Arc<dyn WorkflowRepository>,
    session_manager: Arc<SessionManager>,
    logs: Arc<dyn LogRepository>,
}

impl WorkflowEngine {
    pub fn new(
        repo: Arc<dyn WorkflowRepository>,
        session_manager: Arc<SessionManager>,
        logs: Arc<dyn LogRepository>,
    ) -> Self {
        Self {
            repo,
            session_manager,
            logs,
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

                    // Capture result output for context passing
                    self.logs.flush().await;
                    if let Ok(logs) = self.logs.query_logs(session_id, 0, 1000).await {
                        if let Some(output) = extract_result_text(&logs) {
                            let _ = self.repo.update_step_result(&step.id, &output).await;
                        }
                    }

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
                // Build effective prompt, injecting parent context if enabled
                let effective_prompt = if step.pass_context {
                    let parent_steps: Vec<&WorkflowStep> = deps
                        .iter()
                        .filter_map(|e| steps.iter().find(|s| s.id == e.source_step_id))
                        .collect();
                    let context_parts: Vec<String> = parent_steps
                        .iter()
                        .filter_map(|ps| {
                            ps.result_output.as_ref().map(|out| {
                                format!("=== Output from '{}' ===\n{}", ps.agent_name, out)
                            })
                        })
                        .collect();
                    if context_parts.is_empty() {
                        step.prompt.clone()
                    } else {
                        format!(
                            "Context from previous workflow steps:\n\n{}\n\n---\n\nYour task:\n{}",
                            context_parts.join("\n\n"),
                            step.prompt
                        )
                    }
                } else {
                    step.prompt.clone()
                };

                // Start this step
                match self
                    .session_manager
                    .start_agent(
                        step.agent_name.clone(),
                        step.model.clone(),
                        effective_prompt,
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

/// Extract the final result text from a session's log entries.
/// Searches in reverse for a `result` message first, falling back to the last `assistant` message.
/// Truncates to MAX_RESULT_OUTPUT_LEN to prevent context explosion.
fn extract_result_text(logs: &[LogEntry]) -> Option<String> {
    // Try to find the last result message
    for log in logs.iter().rev() {
        if log.message_type == "result" {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&log.content) {
                if let Some(text) = parsed.get("result").and_then(|r| r.as_str()) {
                    return Some(truncate_str(text, MAX_RESULT_OUTPUT_LEN));
                }
            }
        }
    }

    // Fall back to last assistant message
    for log in logs.iter().rev() {
        if log.message_type == "assistant" {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&log.content) {
                // Try message.content array (Claude Code format)
                if let Some(content) = parsed
                    .get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_array())
                {
                    let text: String = content
                        .iter()
                        .filter_map(|block| {
                            if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                                block.get("text").and_then(|t| t.as_str()).map(String::from)
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("\n");
                    if !text.is_empty() {
                        return Some(truncate_str(&text, MAX_RESULT_OUTPUT_LEN));
                    }
                }
            }
            // If JSON parsing fails, use raw content as fallback
            if !log.content.is_empty() {
                return Some(truncate_str(&log.content, MAX_RESULT_OUTPUT_LEN));
            }
        }
    }

    None
}

fn truncate_str(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}... [truncated]", &s[..max_len])
    }
}
