import { memo, useMemo, useState } from "react";
import { ChevronRight, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { extractToolCalls, type ToolCall } from "../../lib/logParser";

interface Props {
  sessionId: string;
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function computeDuration(start: string, end?: string): string {
  if (!end) return "—";
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  } catch {
    return "—";
  }
}

const ToolRow = memo(function ToolRow({ call }: { call: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-zinc-800/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2"
      >
        <span className="w-4 flex-shrink-0 text-zinc-600">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>

        <span className="w-16 flex-shrink-0 text-zinc-600">
          {formatTime(call.timestamp)}
        </span>

        <span className="w-28 flex-shrink-0 font-medium text-blue-400">
          {call.toolName}
        </span>

        <span className="min-w-0 flex-1 truncate font-mono text-zinc-400">
          {call.target}
        </span>

        <span className="w-14 flex-shrink-0 text-right text-zinc-600">
          {computeDuration(call.timestamp, call.resultTimestamp)}
        </span>

        <span className="w-5 flex-shrink-0">
          {call.resultTimestamp &&
            (call.isError ? (
              <XCircle size={12} className="text-red-400" />
            ) : (
              <CheckCircle2 size={12} className="text-emerald-500" />
            ))}
        </span>
      </button>

      {expanded && (
        <div className="mx-3 mb-2 ml-7 space-y-2">
          {call.input && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-zinc-600">
                INPUT
              </div>
              <pre className="max-h-48 overflow-auto rounded border border-zinc-800 bg-surface-0 p-2 text-[11px] text-zinc-400">
                {call.input}
              </pre>
            </div>
          )}
          {call.resultSnippet && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-zinc-600">
                OUTPUT
              </div>
              <pre
                className={`max-h-48 overflow-auto rounded border border-zinc-800 bg-surface-0 p-2 text-[11px] ${
                  call.isError ? "text-red-400" : "text-zinc-400"
                }`}
              >
                {call.resultSnippet}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export function ToolsTab({ sessionId }: Props) {
  const logs = useAgentStore((s) => s.logs);
  const sessionLogs = logs.get(sessionId) ?? [];

  const toolCalls = useMemo(
    () => extractToolCalls(sessionLogs),
    [sessionLogs],
  );

  if (toolCalls.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">
        No tool calls recorded
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Table header */}
      <div className="flex items-center gap-3 border-b border-zinc-700 px-3 py-1.5 text-[10px] font-medium text-zinc-500">
        <span className="w-4" />
        <span className="w-16">Time</span>
        <span className="w-28">Tool</span>
        <span className="min-w-0 flex-1">Target</span>
        <span className="w-14 text-right">Duration</span>
        <span className="w-5" />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {toolCalls.map((call, i) => (
          <ToolRow key={i} call={call} />
        ))}
      </div>

      {/* Summary */}
      <div className="flex-shrink-0 border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-600">
        {toolCalls.length} tool call{toolCalls.length !== 1 ? "s" : ""}
        {" · "}
        {toolCalls.filter((c) => c.isError).length} error
        {toolCalls.filter((c) => c.isError).length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
