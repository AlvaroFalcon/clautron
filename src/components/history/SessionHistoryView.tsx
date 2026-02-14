import { useMemo, useState } from "react";
import { Clock, Eye, RotateCcw, Search, X } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { AgentStatusBadge } from "../dashboard/AgentStatusBadge";
import { formatElapsed, formatTokens } from "../../lib/formatters";
import { AGENT_COLORS } from "../../lib/types";
import type { AgentStatus } from "../../lib/types";

type SortField = "agent" | "status" | "duration" | "tokens" | "started";
type SortDir = "asc" | "desc";

export function SessionHistoryView() {
  const sessions = useAgentStore((s) => s.sessions);
  const openDetail = useAgentStore((s) => s.openDetail);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("started");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const allSessions = useMemo(
    () => Array.from(sessions.values()),
    [sessions],
  );

  // Only show terminal sessions
  const terminalSessions = useMemo(
    () =>
      allSessions.filter(
        (s) =>
          s.status === "completed" ||
          s.status === "error" ||
          s.status === "stopped",
      ),
    [allSessions],
  );

  // Unique agent names for filter dropdown
  const agentNames = useMemo(() => {
    const names = new Set(terminalSessions.map((s) => s.agent_name));
    return Array.from(names).sort();
  }, [terminalSessions]);

  // Filter and search
  const filtered = useMemo(() => {
    let result = terminalSessions;

    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    if (agentFilter !== "all") {
      result = result.filter((s) => s.agent_name === agentFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.prompt.toLowerCase().includes(q) ||
          s.agent_name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q),
      );
    }

    return result;
  }, [terminalSessions, statusFilter, agentFilter, search]);

  // Sort
  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;

    list.sort((a, b) => {
      switch (sortField) {
        case "agent":
          return dir * a.agent_name.localeCompare(b.agent_name);
        case "status":
          return dir * a.status.localeCompare(b.status);
        case "duration": {
          const durA = getDurationMs(a);
          const durB = getDurationMs(b);
          return dir * (durA - durB);
        }
        case "tokens":
          return (
            dir *
            (a.input_tokens + a.output_tokens - (b.input_tokens + b.output_tokens))
          );
        case "started":
        default:
          return (
            dir *
            (new Date(a.started_at).getTime() -
              new Date(b.started_at).getTime())
          );
      }
    });

    return list;
  }, [filtered, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

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
      {/* Header with search and filters */}
      <header className="flex flex-shrink-0 flex-col border-b border-zinc-800">
        <div className="flex h-12 items-center justify-between px-6">
          <h2 className="text-sm font-medium text-zinc-300">
            Session History
          </h2>
          <span className="text-xs text-zinc-500">
            {sorted.length} of {terminalSessions.length} session(s)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/50 px-6 py-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts, agents, IDs..."
              className="w-full rounded-lg border border-zinc-700 bg-surface-0 py-1.5 pl-8 pr-8 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-blue-600 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as AgentStatus | "all")
            }
            className="rounded-lg border border-zinc-700 bg-surface-0 px-2 py-1.5 text-xs text-zinc-300 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="error">Error</option>
            <option value="stopped">Stopped</option>
          </select>

          {/* Agent filter */}
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-surface-0 px-2 py-1.5 text-xs text-zinc-300 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All agents</option>
            {agentNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 border-b border-zinc-800 bg-surface-0">
            <tr className="text-left text-xs text-zinc-500">
              <th
                className="cursor-pointer px-6 py-2 font-medium hover:text-zinc-300"
                onClick={() => handleSort("agent")}
              >
                Agent{sortIndicator("agent")}
              </th>
              <th
                className="cursor-pointer px-4 py-2 font-medium hover:text-zinc-300"
                onClick={() => handleSort("status")}
              >
                Status{sortIndicator("status")}
              </th>
              <th className="px-4 py-2 font-medium">Prompt</th>
              <th
                className="cursor-pointer px-4 py-2 font-medium hover:text-zinc-300"
                onClick={() => handleSort("duration")}
              >
                Duration{sortIndicator("duration")}
              </th>
              <th
                className="cursor-pointer px-4 py-2 font-medium hover:text-zinc-300"
                onClick={() => handleSort("tokens")}
              >
                Tokens{sortIndicator("tokens")}
              </th>
              <th
                className="cursor-pointer px-4 py-2 font-medium hover:text-zinc-300"
                onClick={() => handleSort("started")}
              >
                Started{sortIndicator("started")}
              </th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((session) => {
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
                  : "\u2014";

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
                    {formatTokens(
                      session.input_tokens + session.output_tokens,
                    )}
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

        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-zinc-500">
              No sessions match your filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function getDurationMs(session: {
  started_at: string;
  ended_at: string | null;
}): number {
  if (!session.ended_at) return 0;
  return (
    new Date(session.ended_at).getTime() -
    new Date(session.started_at).getTime()
  );
}
