// TypeScript types mirroring Rust models

export type AgentStatus =
  | "idle"
  | "starting"
  | "running"
  | "completed"
  | "error"
  | "stopped";

export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  color: string;
  file_path: string;
}

export interface AgentSession {
  id: string;
  agent_name: string;
  model: string;
  status: AgentStatus;
  prompt: string;
  started_at: string;
  ended_at: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface LogEntry {
  id: number;
  session_id: string;
  message_type: string;
  content: string;
  timestamp: string;
}

// Tauri event payloads
export interface AgentStatusEvent {
  session_id: string;
  agent_name: string;
  status: AgentStatus;
  model: string;
  prompt: string;
  ended_at: string | null;
}

export interface AgentMessageEvent {
  session_id: string;
  message_type: string;
  content: string;
  timestamp: string;
}

export interface AgentUsageEvent {
  session_id: string;
  input_tokens: number;
  output_tokens: number;
}

// App config (mirrors Rust AppConfig)
export interface AppConfig {
  project_path: string | null;
  window_width: number | null;
  window_height: number | null;
  approved_agent_hashes: Record<string, string>;
}

// Unapproved agent for security prompt (P0 Security #4)
export interface UnapprovedAgent {
  file_path: string;
  name: string;
  model: string;
  description: string;
  hash: string;
}

// Agent config change event
export interface AgentConfigChangedEvent {
  changed_files: string[];
}

// Agent color map
export const AGENT_COLORS: Record<string, string> = {
  blue: "var(--color-agent-blue)",
  red: "var(--color-agent-red)",
  green: "var(--color-agent-green)",
  yellow: "var(--color-agent-yellow)",
};

export const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "var(--color-status-idle)",
  starting: "var(--color-status-starting)",
  running: "var(--color-status-running)",
  completed: "var(--color-status-completed)",
  error: "var(--color-status-error)",
  stopped: "var(--color-status-stopped)",
};
