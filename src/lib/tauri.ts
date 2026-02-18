// Typed wrappers for Tauri IPC commands

import { invoke } from "@tauri-apps/api/core";
import type { AgentConfig, AgentConfigUpdate, AgentRelationship, AgentSession, AppConfig, ChangedFile, FileDiff, LogEntry, Spec, SpecPriority, SpecUpdate, UnapprovedAgent, Workflow, WorkflowStep, WorkflowEdge } from "./types";

export async function startAgent(
  name: string,
  model: string,
  prompt: string,
): Promise<string> {
  return invoke("start_agent", { name, model, prompt });
}

export async function stopAgent(sessionId: string): Promise<void> {
  return invoke("stop_agent", { sessionId });
}

export async function resumeAgent(
  sessionId: string,
  prompt: string,
): Promise<string> {
  return invoke("resume_agent", { sessionId, prompt });
}

export async function listSessions(): Promise<AgentSession[]> {
  return invoke("list_sessions");
}

export async function getSession(sessionId: string): Promise<AgentSession> {
  return invoke("get_session", { sessionId });
}

export async function listAgents(): Promise<AgentConfig[]> {
  return invoke("list_agents");
}

export async function setProjectDir(path: string): Promise<void> {
  return invoke("set_project_dir", { path });
}

export async function getProjectDir(): Promise<string | null> {
  return invoke("get_project_dir");
}

export async function checkClaudeAuth(): Promise<boolean> {
  return invoke("check_claude_auth");
}

export async function openClaudeLogin(): Promise<void> {
  return invoke("open_claude_login");
}

export async function getSessionLogs(
  sessionId: string,
  offset?: number,
  limit?: number,
): Promise<LogEntry[]> {
  return invoke("get_session_logs", { sessionId, offset, limit });
}

export async function getSessionLogCount(
  sessionId: string,
): Promise<number> {
  return invoke("get_session_log_count", { sessionId });
}

// Config commands

export async function getConfig(): Promise<AppConfig> {
  return invoke("get_config");
}

export async function saveConfig(config: AppConfig): Promise<void> {
  return invoke("save_config", { config });
}

export async function setProjectPath(path: string): Promise<void> {
  return invoke("set_project_path", { path });
}

export async function getProjectPath(): Promise<string | null> {
  return invoke("get_project_path");
}

export async function checkAgentApproval(): Promise<UnapprovedAgent[]> {
  return invoke("check_agent_approval");
}

export async function approveAgents(
  agents: [string, string][],
): Promise<void> {
  return invoke("approve_agents", { agents });
}

// Agent config CRUD commands

export async function getAgent(filePath: string): Promise<AgentConfig> {
  return invoke("get_agent", { filePath });
}

export async function createAgentConfig(
  name: string,
  model: string,
  description: string,
  color: string,
): Promise<AgentConfig> {
  return invoke("create_agent_config", { name, model, description, color });
}

export async function updateAgentConfig(
  filePath: string,
  update: AgentConfigUpdate,
): Promise<AgentConfig> {
  return invoke("update_agent_config", { filePath, update });
}

export async function deleteAgentConfig(filePath: string): Promise<void> {
  return invoke("delete_agent_config", { filePath });
}

export async function getAgentRelationships(): Promise<AgentRelationship[]> {
  return invoke("get_agent_relationships");
}

export async function generateText(prompt: string): Promise<string> {
  return invoke("generate_text", { prompt });
}

// Spec commands

export async function listSpecs(): Promise<Spec[]> {
  return invoke("list_specs");
}

export async function getSpec(filePath: string): Promise<Spec> {
  return invoke("get_spec", { filePath });
}

export async function createSpec(
  title: string,
  priority: SpecPriority,
): Promise<Spec> {
  return invoke("create_spec", { title, priority });
}

export async function updateSpec(
  filePath: string,
  update: SpecUpdate,
): Promise<Spec> {
  return invoke("update_spec", { filePath, update });
}

export async function deleteSpec(filePath: string): Promise<void> {
  return invoke("delete_spec", { filePath });
}

export async function runSpec(
  specPath: string,
  agentName: string,
  model: string,
): Promise<string> {
  return invoke("run_spec", { specPath, agentName, model });
}

// Review commands

export async function getChangedFiles(): Promise<ChangedFile[]> {
  return invoke("get_changed_files");
}

export async function getDiff(paths?: string[]): Promise<FileDiff[]> {
  return invoke("get_diff", { paths: paths ?? null });
}

// Workflow commands

export async function createWorkflow(
  name: string,
  description?: string,
): Promise<Workflow> {
  return invoke("create_workflow", { name, description: description ?? null });
}

export async function getWorkflow(id: string): Promise<Workflow> {
  return invoke("get_workflow", { id });
}

export async function listWorkflows(): Promise<Workflow[]> {
  return invoke("list_workflows");
}

export async function deleteWorkflow(id: string): Promise<void> {
  return invoke("delete_workflow", { id });
}

export async function addWorkflowStep(
  workflowId: string,
  agentName: string,
  model: string,
  prompt: string,
  specPath: string | null,
  positionX: number,
  positionY: number,
  passContext?: boolean,
): Promise<WorkflowStep> {
  return invoke("add_workflow_step", {
    workflowId,
    agentName,
    model,
    prompt,
    specPath,
    positionX,
    positionY,
    passContext: passContext ?? false,
  });
}

export async function updateWorkflowStep(
  step: WorkflowStep,
): Promise<void> {
  return invoke("update_workflow_step", { step });
}

export async function removeWorkflowStep(id: string): Promise<void> {
  return invoke("remove_workflow_step", { id });
}

export async function getWorkflowSteps(
  workflowId: string,
): Promise<WorkflowStep[]> {
  return invoke("get_workflow_steps", { workflowId });
}

export async function addWorkflowEdge(
  workflowId: string,
  sourceStepId: string,
  targetStepId: string,
): Promise<WorkflowEdge> {
  return invoke("add_workflow_edge", {
    workflowId,
    sourceStepId,
    targetStepId,
  });
}

export async function removeWorkflowEdge(id: string): Promise<void> {
  return invoke("remove_workflow_edge", { id });
}

export async function getWorkflowEdges(
  workflowId: string,
): Promise<WorkflowEdge[]> {
  return invoke("get_workflow_edges", { workflowId });
}

export async function startWorkflow(id: string): Promise<void> {
  return invoke("start_workflow", { id });
}

export async function stopWorkflow(id: string): Promise<void> {
  return invoke("stop_workflow", { id });
}

export async function validateWorkflow(id: string): Promise<void> {
  return invoke("validate_workflow", { id });
}
