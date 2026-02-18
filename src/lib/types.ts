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
  body: string;
}

export interface AgentConfigUpdate {
  name?: string;
  description?: string;
  model?: string;
  color?: string;
  body?: string;
}

export interface AgentRelationship {
  source_agent: string;
  target_agent: string;
  workflow_names: string[];
  edge_count: number;
}

export const AGENT_COLOR_OPTIONS = [
  { value: "blue", label: "Blue", hex: "#3b82f6" },
  { value: "red", label: "Red", hex: "#ef4444" },
  { value: "green", label: "Green", hex: "#22c55e" },
  { value: "yellow", label: "Yellow", hex: "#f59e0b" },
  { value: "purple", label: "Purple", hex: "#a855f7" },
  { value: "pink", label: "Pink", hex: "#ec4899" },
  { value: "cyan", label: "Cyan", hex: "#06b6d4" },
  { value: "gray", label: "Gray", hex: "#71717a" },
] as const;

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

// --- Specs ---

export type SpecStatus =
  | "draft"
  | "assigned"
  | "in_progress"
  | "review"
  | "done"
  | "rejected";

export type SpecPriority = "p0" | "p1" | "p2";

export interface Spec {
  title: string;
  priority: SpecPriority;
  status: SpecStatus;
  acceptance_criteria: string[];
  assigned_agent: string | null;
  assigned_session_id: string | null;
  parent_spec: string | null;
  created_at: string;
  updated_at: string;
  file_path: string;
  body: string;
}

export interface SpecUpdate {
  title?: string;
  priority?: SpecPriority;
  status?: SpecStatus;
  acceptance_criteria?: string[];
  assigned_agent?: string | null;
  assigned_session_id?: string | null;
  parent_spec?: string | null;
  body?: string;
}

export interface SpecsChangedEvent {
  changed_files: string[];
}

export interface SpecStatusChangedEvent {
  file_path: string;
  status: string;
}

export const SPEC_STATUS_COLORS: Record<SpecStatus, string> = {
  draft: "#71717a",      // zinc-500
  assigned: "#3b82f6",   // blue-500
  in_progress: "#f59e0b", // amber-500
  review: "#a855f7",     // purple-500
  done: "#22c55e",       // green-500
  rejected: "#ef4444",   // red-500
};

export const SPEC_STATUS_LABELS: Record<SpecStatus, string> = {
  draft: "Draft",
  assigned: "Assigned",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  rejected: "Rejected",
};

export const SPEC_PRIORITY_COLORS: Record<SpecPriority, string> = {
  p0: "#ef4444", // red
  p1: "#f59e0b", // amber
  p2: "#3b82f6", // blue
};

// --- Review / Git Diffs ---

export interface ChangedFile {
  path: string;
  status: string; // "M", "A", "D", "R", "?"
}

export interface DiffLine {
  line_type: string; // "add", "remove", "context"
  content: string;
  old_line: number | null;
  new_line: number | null;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  change_type: string; // "modified", "added", "deleted", "renamed"
  hunks: DiffHunk[];
}

export const CHANGE_TYPE_COLORS: Record<string, string> = {
  modified: "#f59e0b", // amber
  added: "#22c55e",    // green
  deleted: "#ef4444",  // red
  renamed: "#3b82f6",  // blue
};

// --- Workflows ---

export type WorkflowStatus =
  | "draft"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  agent_name: string;
  model: string;
  prompt: string;
  spec_path: string | null;
  status: StepStatus;
  session_id: string | null;
  position_x: number;
  position_y: number;
  created_at: string;
  pass_context: boolean;
  result_output: string | null;
}

export interface WorkflowEdge {
  id: string;
  workflow_id: string;
  source_step_id: string;
  target_step_id: string;
}

export const WORKFLOW_STATUS_COLORS: Record<WorkflowStatus, string> = {
  draft: "#71717a",
  ready: "#3b82f6",
  running: "#f59e0b",
  completed: "#22c55e",
  failed: "#ef4444",
  cancelled: "#71717a",
};

export const STEP_STATUS_COLORS: Record<StepStatus, string> = {
  pending: "#71717a",
  running: "#f59e0b",
  completed: "#22c55e",
  failed: "#ef4444",
  skipped: "#71717a",
};

export interface WorkflowStatusEvent {
  workflow_id: string;
  status: WorkflowStatus;
}

export interface StepStatusEvent {
  workflow_id: string;
  step_id: string;
  status: StepStatus;
  session_id: string | null;
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
