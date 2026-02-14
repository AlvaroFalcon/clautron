import { memo, useState, useEffect, useMemo } from "react";
import { Square, Eye, FileText, GitBranch } from "lucide-react";
import type { AgentSession } from "../../lib/types";
import { AGENT_COLORS } from "../../lib/types";
import { formatElapsed } from "../../lib/formatters";
import { AgentStatusBadge } from "./AgentStatusBadge";
import { useAgentStore } from "../../stores/agentStore";
import { useSpecStore } from "../../stores/specStore";

interface Props {
  session: AgentSession;
  onSelect: (sessionId: string) => void;
}

export const AgentCard = memo(function AgentCard({ session, onSelect }: Props) {
  const stopAgent = useAgentStore((s) => s.stopAgent);
  const openDetail = useAgentStore((s) => s.openDetail);
  const logs = useAgentStore((s) => s.logs);
  const specs = useSpecStore((s) => s.specs);
  const [elapsed, setElapsed] = useState("");

  const linkedSpec = useMemo(
    () => specs.find((s) => s.assigned_session_id === session.id),
    [specs, session.id],
  );

  const isActive =
    session.status === "running" || session.status === "starting";

  // Elapsed time ticker
  useEffect(() => {
    if (!isActive) {
      if (session.ended_at) {
        const start = new Date(session.started_at).getTime();
        const end = new Date(session.ended_at).getTime();
        const seconds = Math.floor((end - start) / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        setElapsed(m > 0 ? `${m}m ${s}s` : `${s}s`);
      }
      return;
    }

    const update = () => setElapsed(formatElapsed(session.started_at));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isActive, session.started_at, session.ended_at]);

  // Last activity snippet from logs
  const sessionLogs = logs.get(session.id) ?? [];
  const lastLog = sessionLogs[sessionLogs.length - 1];
  const lastActivity = lastLog
    ? `[${lastLog.message_type}] ${lastLog.content.slice(0, 80)}`
    : session.prompt.slice(0, 80);

  const agentColor =
    AGENT_COLORS[session.agent_name.includes("architect") ? "red"
      : session.agent_name.includes("security") ? "green"
      : session.agent_name.includes("orchestrator") ? "yellow"
      : "blue"] ?? AGENT_COLORS.blue;

  return (
    <div
      onClick={() => onSelect(session.id)}
      className="group flex cursor-pointer flex-col rounded-lg border border-zinc-800 bg-surface-1 p-4 transition-colors hover:border-zinc-700"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: agentColor }}
          />
          <span className="text-sm font-medium text-zinc-100">
            {session.agent_name}
          </span>
        </div>
        <AgentStatusBadge status={session.status} />
      </div>

      {/* Linked spec */}
      {linkedSpec && (
        <div className="mb-2 flex items-center gap-1 text-[11px] text-purple-400">
          <FileText size={11} />
          <span className="truncate">{linkedSpec.title}</span>
        </div>
      )}

      {/* Prompt snippet */}
      <p className="mb-3 line-clamp-2 text-xs text-zinc-400">
        {session.prompt}
      </p>

      {/* Last activity */}
      <div className="mb-3 min-h-[20px] font-mono text-[11px] text-zinc-500 line-clamp-1">
        {lastActivity}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-zinc-800 pt-3">
        <span className="text-xs text-zinc-500">{elapsed}</span>

        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDetail(session.id);
            }}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-surface-2 hover:text-zinc-300"
            title="View details"
          >
            <Eye size={14} />
          </button>
          {session.status === "completed" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openDetail(session.id);
              }}
              className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-purple-900/30 hover:text-purple-400"
              title="Review output"
            >
              <GitBranch size={14} />
            </button>
          )}
          {isActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                stopAgent(session.id);
              }}
              className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
              title="Stop agent"
            >
              <Square size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
