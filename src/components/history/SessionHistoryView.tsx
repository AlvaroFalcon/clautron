import { useMemo } from "react";
import { Clock, Eye, RotateCcw } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { AgentStatusBadge } from "../dashboard/AgentStatusBadge";
import { formatElapsed, formatTokens } from "../../lib/formatters";
import { AGENT_COLORS } from "../../lib/types";

export function SessionHistoryView() {
  const sessions = useAgentStore((s) => s.sessions);
  const openDetail = useAgentStore((s) => s.openDetail);

  const sortedSessions = useMemo(() => {
    return Array.from(sessions.values()).sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );
  }, [sessions]);

  const terminalSessions = useMemo(
    () =>
      sortedSessions.filter(
        (s) =>
          s.status === "completed" ||
          s.status === "error" ||
          s.status === "stopped",
      ),
    [sortedSessions],
  );

  if (terminalSessions.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 flex-shrink-0 items-center border-b border-zinc-800 px-6">
          <h2 className="text-sm font-medium text-zinc-300">
            Session History
          </h2>
        </header>
        <div className="flex flex-1 items-center justify-center text-zinc-500">
          <div className="text-center">
            <Clock size={48} className="mx-auto mb-3 text-zinc-700" />
            <p className="text-sm">No past sessions</p>
            <p className="mt-1 text-xs text-zinc-600">
              Completed agent sessions will appear here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-zinc-800 px-6">
        <h2 className="text-sm font-medium text-zinc-300">Session History</h2>
        <span className="text-xs text-zinc-500">
          {terminalSessions.length} session(s)
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 border-b border-zinc-800 bg-surface-0">
            <tr className="text-left text-xs text-zinc-500">
              <th className="px-6 py-2 font-medium">Agent</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Prompt</th>
              <th className="px-4 py-2 font-medium">Duration</th>
              <th className="px-4 py-2 font-medium">Tokens</th>
              <th className="px-4 py-2 font-medium">Started</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {terminalSessions.map((session) => {
              const agentColor =
                AGENT_COLORS[
                  session.agent_name.includes("architect")
                    ? "red"
                    : session.agent_name.includes("security")
                      ? "green"
                      : session.agent_name.includes("orchestrator")
                        ? "yellow"
                        : "blue"
                ] ?? AGENT_COLORS.blue;

              const duration =
                session.ended_at && session.started_at
                  ? formatElapsed(
                      session.started_at,
                      new Date(session.ended_at).getTime(),
                    )
                  : "—";

              return (
                <tr
                  key={session.id}
                  className="border-b border-zinc-800/50 transition-colors hover:bg-surface-1"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: agentColor }}
                      />
                      <span className="text-sm text-zinc-200">
                        {session.agent_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <AgentStatusBadge status={session.status} />
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-zinc-400">
                    {session.prompt}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {duration}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {formatTokens(session.input_tokens + session.output_tokens)}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(session.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openDetail(session.id)}
                        className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-surface-2 hover:text-zinc-300"
                        title="View details"
                      >
                        <Eye size={14} />
                      </button>
                      {session.status !== "completed" && (
                        <button
                          onClick={() => openDetail(session.id)}
                          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-surface-2 hover:text-blue-400"
                          title="Resume session"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
