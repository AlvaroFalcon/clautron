import { useEffect, useState } from "react";
import { Command } from "cmdk";
import {
  Play,
  Square,
  LayoutDashboard,
  History,
  Settings,
  Eye,
  FolderOpen,
} from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";

interface CommandPaletteProps {
  onViewChange: (view: string) => void;
  onChangeProject: () => void;
  onStartAgent: () => void;
}

export function CommandPalette({
  onViewChange,
  onChangeProject,
  onStartAgent,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const sessions = useAgentStore((s) => s.sessions);
  const stopAgent = useAgentStore((s) => s.stopAgent);
  const openDetail = useAgentStore((s) => s.openDetail);

  const runningSessions = Array.from(sessions.values()).filter(
    (s) => s.status === "running" || s.status === "starting",
  );

  const allSessions = Array.from(sessions.values());

  // Cmd+K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function runAction(fn: () => void) {
    fn();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div className="absolute left-1/2 top-[20%] w-full max-w-lg -translate-x-1/2">
        <Command className="rounded-xl border border-zinc-700 bg-surface-1 shadow-2xl">
          <Command.Input
            placeholder="Type a command..."
            className="w-full border-b border-zinc-800 bg-transparent px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-6 text-center text-sm text-zinc-500">
              No results found.
            </Command.Empty>

            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-zinc-500"
            >
              <Command.Item
                onSelect={() => runAction(onStartAgent)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 aria-selected:bg-surface-2 aria-selected:text-zinc-100"
              >
                <Play size={14} className="text-green-400" />
                Start New Agent
              </Command.Item>
              <Command.Item
                onSelect={() => runAction(onChangeProject)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 aria-selected:bg-surface-2 aria-selected:text-zinc-100"
              >
                <FolderOpen size={14} className="text-blue-400" />
                Change Project
              </Command.Item>
            </Command.Group>

            <Command.Group
              heading="Navigate"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-zinc-500"
            >
              <Command.Item
                onSelect={() => runAction(() => onViewChange("dashboard"))}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 aria-selected:bg-surface-2 aria-selected:text-zinc-100"
              >
                <LayoutDashboard size={14} />
                Go to Dashboard
              </Command.Item>
              <Command.Item
                onSelect={() => runAction(() => onViewChange("history"))}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 aria-selected:bg-surface-2 aria-selected:text-zinc-100"
              >
                <History size={14} />
                Go to History
              </Command.Item>
              <Command.Item
                onSelect={() => runAction(() => onViewChange("settings"))}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 aria-selected:bg-surface-2 aria-selected:text-zinc-100"
              >
                <Settings size={14} />
                Go to Settings
              </Command.Item>
            </Command.Group>

            {runningSessions.length > 0 && (
              <Command.Group
                heading="Stop Agent"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-zinc-500"
              >
                {runningSessions.map((s) => (
                  <Command.Item
                    key={`stop-${s.id}`}
                    onSelect={() => runAction(() => stopAgent(s.id))}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 aria-selected:bg-surface-2 aria-selected:text-zinc-100"
                  >
                    <Square size={14} className="text-red-400" />
                    Stop {s.agent_name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {allSessions.length > 0 && (
              <Command.Group
                heading="View Agent"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-zinc-500"
              >
                {allSessions.slice(0, 10).map((s) => (
                  <Command.Item
                    key={`view-${s.id}`}
                    onSelect={() => runAction(() => openDetail(s.id))}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 aria-selected:bg-surface-2 aria-selected:text-zinc-100"
                  >
                    <Eye size={14} className="text-zinc-400" />
                    {s.agent_name}{" "}
                    <span className="text-xs text-zinc-500">({s.status})</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-600">
            <kbd className="rounded border border-zinc-700 px-1">Esc</kbd> to
            close
          </div>
        </Command>
      </div>
    </div>
  );
}
