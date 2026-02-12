// Typed wrappers for Tauri IPC commands

import { invoke } from "@tauri-apps/api/core";
import type { AgentConfig, AgentSession, AppConfig, LogEntry, UnapprovedAgent } from "./types";

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
