import { useState, useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Plus, Inbox, X } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { AgentCard } from "./AgentCard";
import { StartAgentDialog } from "./StartAgentDialog";
import { AgentLogViewer } from "../logs/AgentLogViewer";
import { AgentStatusBadge } from "./AgentStatusBadge";
import { AGENT_COLORS } from "../../lib/types";

export function DashboardView() {
  const sessions = useAgentStore((s) => s.sessions);
  const selectedSessionId = useAgentStore((s) => s.selectedSessionId);
  const selectSession = useAgentStore((s) => s.selectSession);
  const [startDialogOpen, setStartDialogOpen] = useState(false);

  const selectedSession = selectedSessionId
    ? sessions.get(selectedSessionId) ?? null
    : null;

  const sortedSessions = useMemo(() => {
    const list = Array.from(sessions.values());
    return list.sort((a, b) => {
      const aActive = a.status === "running" || a.status === "starting";
      const bActive = b.status === "running" || b.status === "starting";
      if (aActive !== bActive) return aActive ? -1 : 1;
      return (
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      );
    });
  }, [sessions]);

  const agentColor = selectedSession
    ? AGENT_COLORS[
        selectedSession.agent_name.includes("architect")
          ? "red"
          : selectedSession.agent_name.includes("security")
            ? "green"
            : selectedSession.agent_name.includes("orchestrator")
              ? "yellow"
              : "blue"
      ] ?? AGENT_COLORS.blue
    : undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-zinc-800 px-6">
        <h2 className="text-sm font-medium text-zinc-300">Dashboard</h2>
        <button
          onClick={() => setStartDialogOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Plus size={14} />
          Start Agent
        </button>
      </header>

      {/* Content area with optional log panel */}
      {sortedSessions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Inbox size={48} className="mx-auto mb-3 text-zinc-700" />
            <p className="text-sm text-zinc-400">No agent sessions yet</p>
            <p className="mt-1 text-xs text-zinc-600">
              Start an agent to begin monitoring
            </p>
            <button
              onClick={() => setStartDialogOpen(true)}
              className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-surface-2"
            >
              <Plus size={14} />
              Start your first agent
            </button>
          </div>
        </div>
      ) : selectedSession ? (
        <PanelGroup direction="horizontal" className="flex-1">
          {/* Agent cards panel */}
          <Panel defaultSize={40} minSize={25}>
            <div className="h-full overflow-y-auto p-4">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {sortedSessions.map((session) => (
                  <AgentCard
                    key={session.id}
                    session={session}
                    onSelect={selectSession}
                  />
                ))}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-zinc-800 transition-colors hover:bg-zinc-600 data-[resize-handle-active]:bg-blue-500" />

          {/* Log viewer panel */}
          <Panel defaultSize={60} minSize={30}>
            <div className="flex h-full flex-col border-l border-zinc-800">
              {/* Log panel header */}
              <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-zinc-800 px-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: agentColor }}
                  />
                  <span className="text-xs font-medium text-zinc-300">
                    {selectedSession.agent_name}
                  </span>
                  <AgentStatusBadge status={selectedSession.status} />
                </div>
                <button
                  onClick={() => selectSession(null)}
                  className="rounded p-1 text-zinc-500 transition-colors hover:bg-surface-2 hover:text-zinc-300"
                  title="Close log viewer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Log content */}
              <div className="flex-1 overflow-hidden">
                <AgentLogViewer sessionId={selectedSession.id} />
              </div>
            </div>
          </Panel>
        </PanelGroup>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedSessions.map((session) => (
              <AgentCard
                key={session.id}
                session={session}
                onSelect={selectSession}
              />
            ))}
          </div>
        </div>
      )}

      <StartAgentDialog
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
      />
    </div>
  );
}
