// Extract structured data from raw log messages for the detail view tabs.
//
// Claude Code stream-json format (actual observed):
//   type:"system"    — init message with session info
//   type:"assistant" — message.content[] has {type:"text"} and {type:"tool_use", name, input}
//   type:"user"      — message.content[] has {type:"tool_result", tool_use_id, content}
//                       also has tool_use_result with file info etc.
//   type:"result"    — final result with .result (string), .subtype, .total_cost_usd, .usage
//
// IMPORTANT: stream-json emits CUMULATIVE assistant/user messages. Each new message
// of the same type contains ALL content up to that point (not just the delta).
// We must collapse consecutive runs of the same type, keeping only the last.

interface LogMessage {
  session_id: string;
  message_type: string;
  content: string;
  timestamp: string;
}

/**
 * Collapse consecutive log entries of the same top-level type, keeping only the
 * last in each run. This handles Claude Code's cumulative message format where
 * each assistant/user message is a full snapshot, not an incremental delta.
 */
export function deduplicateStreamLogs(logs: LogMessage[]): LogMessage[] {
  const result: LogMessage[] = [];
  for (let i = 0; i < logs.length; i++) {
    const currentType = logs[i].message_type;
    const nextType = i + 1 < logs.length ? logs[i + 1].message_type : null;
    // For cumulative message types, skip if the next entry is the same type
    if (currentType !== "stderr" && currentType === nextType) {
      continue;
    }
    result.push(logs[i]);
  }
  return result;
}

// --- Conversation ---

export interface ConversationItem {
  type: "assistant" | "tool_call" | "tool_result" | "result" | "system" | "error";
  timestamp: string;
  text: string;
  toolName?: string;
  toolInput?: string;
  toolUseId?: string;
  isError?: boolean;
}

export function buildConversation(logs: LogMessage[]): ConversationItem[] {
  const items: ConversationItem[] = [];
  const dedupedLogs = deduplicateStreamLogs(logs);

  for (const log of dedupedLogs) {
    try {
      const parsed = JSON.parse(log.content);
      const topType = parsed?.type;

      if (topType === "system") {
        const subtype = parsed?.subtype;
        if (subtype === "init") {
          items.push({ type: "system", timestamp: log.timestamp, text: "Session initialized" });
        }
      } else if (topType === "assistant") {
        const blocks = parsed?.message?.content;
        if (Array.isArray(blocks)) {
          for (const block of blocks) {
            if (block.type === "text" && block.text) {
              items.push({ type: "assistant", timestamp: log.timestamp, text: block.text });
            } else if (block.type === "tool_use") {
              items.push({
                type: "tool_call",
                timestamp: log.timestamp,
                text: block.name || "unknown",
                toolName: block.name || "unknown",
                toolUseId: block.id,
                toolInput: block.input ? JSON.stringify(block.input, null, 2) : undefined,
              });
            }
          }
        }
      } else if (topType === "user") {
        const blocks = parsed?.message?.content;
        if (Array.isArray(blocks)) {
          for (const block of blocks) {
            if (block.type === "tool_result") {
              const content = block.content ?? "";
              const text = typeof content === "string" ? content : JSON.stringify(content);
              items.push({
                type: "tool_result",
                timestamp: log.timestamp,
                text: text.slice(0, 2000),
                toolUseId: block.tool_use_id,
                isError: block.is_error === true,
              });
            }
          }
        }
      } else if (topType === "result") {
        const subtype = parsed?.subtype;
        const resultText = parsed?.result;
        if (subtype === "error" || parsed?.is_error === true) {
          items.push({
            type: "error",
            timestamp: log.timestamp,
            text: resultText || parsed?.error || "Agent encountered an error",
            isError: true,
          });
        } else if (resultText) {
          items.push({ type: "result", timestamp: log.timestamp, text: resultText });
        }
      }
    } catch {
      // Unparseable log (e.g. stderr), skip
    }
  }

  return items;
}

// --- Tool Calls ---

export interface ToolCall {
  timestamp: string;
  toolName: string;
  toolUseId: string;
  target: string;
  input: string;
  resultTimestamp?: string;
  resultSnippet?: string;
  isError: boolean;
}

export function extractToolCalls(logs: LogMessage[]): ToolCall[] {
  const calls: ToolCall[] = [];
  // Map tool_use_id -> index in calls array for pairing results
  const idToIndex = new Map<string, number>();
  const dedupedLogs = deduplicateStreamLogs(logs);

  for (const log of dedupedLogs) {
    try {
      const parsed = JSON.parse(log.content);
      const topType = parsed?.type;

      if (topType === "assistant") {
        const blocks = parsed?.message?.content;
        if (Array.isArray(blocks)) {
          for (const block of blocks) {
            if (block.type === "tool_use") {
              const toolName = block.name || "unknown";
              const input = block.input;
              let target = "";
              if (input) {
                target =
                  input.file_path ||
                  input.path ||
                  input.command?.slice(0, 80) ||
                  input.query?.slice(0, 80) ||
                  input.pattern?.slice(0, 80) ||
                  input.url?.slice(0, 80) ||
                  "";
              }

              const idx = calls.length;
              calls.push({
                timestamp: log.timestamp,
                toolName,
                toolUseId: block.id || "",
                target,
                input: input ? JSON.stringify(input, null, 2) : "",
                isError: false,
              });
              if (block.id) {
                idToIndex.set(block.id, idx);
              }
            }
          }
        }
      } else if (topType === "user") {
        const blocks = parsed?.message?.content;
        if (Array.isArray(blocks)) {
          for (const block of blocks) {
            if (block.type === "tool_result" && block.tool_use_id) {
              const idx = idToIndex.get(block.tool_use_id);
              if (idx !== undefined) {
                calls[idx].resultTimestamp = log.timestamp;
                calls[idx].isError = block.is_error === true;

                // Extract snippet from the tool_use_result if available
                const toolResult = parsed?.tool_use_result;
                const content = block.content ?? "";
                const text = typeof content === "string"
                  ? content
                  : toolResult?.type === "text"
                    ? (toolResult.file?.content ?? JSON.stringify(content))
                    : JSON.stringify(content);
                calls[idx].resultSnippet = text.slice(0, 500);
              }
            }
          }
        }
      }
    } catch {
      // skip
    }
  }

  return calls;
}

// --- File Activity ---

export interface FileActivity {
  path: string;
  operations: Array<{
    type: string;
    toolName: string;
    timestamp: string;
  }>;
}

export function extractFileActivity(logs: LogMessage[]): FileActivity[] {
  const fileMap = new Map<string, FileActivity["operations"]>();
  const dedupedLogs = deduplicateStreamLogs(logs);

  for (const log of dedupedLogs) {
    try {
      const parsed = JSON.parse(log.content);
      if (parsed?.type !== "assistant") continue;

      const blocks = parsed?.message?.content;
      if (!Array.isArray(blocks)) continue;

      for (const block of blocks) {
        if (block.type !== "tool_use") continue;

        const toolName = (block.name || "").toLowerCase();
        const input = block.input;
        if (!input) continue;

        const filePath = input.file_path || input.path;
        if (!filePath || typeof filePath !== "string") continue;

        let opType = "access";
        if (toolName === "write" || toolName.includes("write")) opType = "write";
        else if (toolName === "edit" || toolName.includes("edit")) opType = "edit";
        else if (toolName === "read" || toolName.includes("read")) opType = "read";
        else if (toolName === "glob" || toolName === "grep" || toolName.includes("search")) opType = "search";

        const ops = fileMap.get(filePath) ?? [];
        ops.push({ type: opType, toolName: block.name || toolName, timestamp: log.timestamp });
        fileMap.set(filePath, ops);
      }
    } catch {
      // skip
    }
  }

  return Array.from(fileMap.entries())
    .map(([path, operations]) => ({ path, operations }))
    .sort((a, b) => b.operations.length - a.operations.length);
}

// --- Execution Graph ---

export type ExecutionNodeType =
  | "session-root"
  | "task"
  | "bash"
  | "file-write"
  | "file-read-cluster"
  | "result";

export interface ExecutionGraphNode {
  id: string;
  nodeType: ExecutionNodeType;
  timestamp: string;
  // session-root
  agentName?: string;
  model?: string;
  prompt?: string;
  sessionStatus?: string;
  // task
  taskDescription?: string;
  taskPrompt?: string;
  // bash
  command?: string;
  // file-write
  filePath?: string;
  writeToolName?: string;
  // file-read-cluster
  readFiles?: string[];
  // result
  resultText?: string;
  isError?: boolean;
  [key: string]: unknown;
}

export interface ExecutionGraphData {
  nodes: ExecutionGraphNode[];
  edges: Array<{ id: string; source: string; target: string }>;
}

export function buildExecutionGraph(
  logs: Array<{ session_id: string; message_type: string; content: string; timestamp: string }>,
  session: {
    agent_name: string;
    model: string;
    prompt: string;
    status: string;
    started_at: string;
  },
): ExecutionGraphData {
  const nodes: ExecutionGraphNode[] = [];

  // Root node is always present
  nodes.push({
    id: "root",
    nodeType: "session-root",
    timestamp: session.started_at,
    agentName: session.agent_name,
    model: session.model,
    prompt: session.prompt,
    sessionStatus: session.status,
  });

  const dedupedLogs = deduplicateStreamLogs(logs);
  let counter = 0;
  const nextId = () => `gn-${++counter}`;

  // Accumulate consecutive reads into a cluster node
  let pendingReads: string[] = [];
  let pendingReadsTimestamp = "";

  const flushReads = () => {
    if (pendingReads.length === 0) return;
    nodes.push({
      id: nextId(),
      nodeType: "file-read-cluster",
      timestamp: pendingReadsTimestamp,
      readFiles: [...new Set(pendingReads)],
    });
    pendingReads = [];
    pendingReadsTimestamp = "";
  };

  for (const log of dedupedLogs) {
    try {
      const parsed = JSON.parse(log.content);
      const topType = parsed?.type;

      if (topType === "assistant") {
        const blocks = parsed?.message?.content;
        if (!Array.isArray(blocks)) continue;

        for (const block of blocks) {
          if (block.type !== "tool_use") continue;
          const name = (block.name || "").toLowerCase();
          const input = block.input || {};

          if (name === "task") {
            flushReads();
            nodes.push({
              id: nextId(),
              nodeType: "task",
              timestamp: log.timestamp,
              taskDescription: input.description || "",
              taskPrompt: input.prompt || "",
            });
          } else if (name === "bash") {
            flushReads();
            nodes.push({
              id: nextId(),
              nodeType: "bash",
              timestamp: log.timestamp,
              command: input.command || "",
            });
          } else if (
            name === "write" ||
            name === "edit" ||
            name === "multiedit" ||
            name === "notebookedit"
          ) {
            flushReads();
            nodes.push({
              id: nextId(),
              nodeType: "file-write",
              timestamp: log.timestamp,
              filePath:
                input.file_path || input.notebook_path || input.path || "",
              writeToolName: block.name || name,
            });
          } else if (
            name === "read" ||
            name === "glob" ||
            name === "grep" ||
            name === "webfetch" ||
            name === "websearch"
          ) {
            const path =
              input.file_path ||
              input.path ||
              input.pattern ||
              input.url ||
              input.query ||
              "";
            pendingReads.push(path);
            if (!pendingReadsTimestamp) pendingReadsTimestamp = log.timestamp;
          }
          // All other tools are omitted from the graph
        }
      } else if (topType === "result") {
        flushReads();
        const isError =
          parsed?.subtype === "error" || parsed?.is_error === true;
        const resultText = (parsed?.result || "").slice(0, 500);
        if (resultText || isError) {
          nodes.push({
            id: nextId(),
            nodeType: "result",
            timestamp: log.timestamp,
            resultText,
            isError,
          });
        }
      }
    } catch {
      // skip unparseable log entries
    }
  }

  flushReads();

  const edges = nodes.slice(1).map((node, i) => ({
    id: `e-${i}`,
    source: nodes[i].id,
    target: node.id,
  }));

  return { nodes, edges };
}
