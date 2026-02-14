import { LayoutDashboard, Settings, History, FolderOpen, FileText, GitFork, DollarSign } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { useSpecStore } from "../../stores/specStore";
import { useWorkflowStore } from "../../stores/workflowStore";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  projectPath: string | null;
  onChangeProject: () => void;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "specs", label: "Specs", icon: FileText },
  { id: "workflows", label: "Workflows", icon: GitFork },
  { id: "history", label: "History", icon: History },
  { id: "costs", label: "Costs", icon: DollarSign },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  activeView,
  onViewChange,
  projectPath,
  onChangeProject,
}: SidebarProps) {
  const configs = useAgentStore((s) => s.configs);
  const sessions = useAgentStore((s) => s.sessions);
  const specCount = useSpecStore((s) => s.specs.length);
  const workflowCount = useWorkflowStore((s) => s.workflows.length);

  const runningCount = Array.from(sessions.values()).filter(
    (s) => s.status === "running" || s.status === "starting",
  ).length;

  const projectName = projectPath
    ? projectPath.split("/").filter(Boolean).pop() ?? "Project"
    : null;

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-zinc-800 bg-surface-1">
      <div className="flex h-12 items-center border-b border-zinc-800 px-4">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
          Mission Control
        </h1>
        {runningCount > 0 && (
          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-status-running text-[10px] font-bold text-white">
            {runningCount}
          </span>
        )}
      </div>

      {projectName && (
        <div className="border-b border-zinc-800 px-3 py-2">
          <button
            onClick={onChangeProject}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
          >
            <FolderOpen size={14} className="flex-shrink-0 text-zinc-500" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-zinc-200">
                {projectName}
              </div>
              <div className="truncate text-[10px] text-zinc-500">
                {projectPath}
              </div>
            </div>
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-surface-2 text-zinc-100"
                  : "text-zinc-400 hover:bg-surface-2 hover:text-zinc-200"
              }`}
            >
              <Icon size={16} />
              {item.label}
              {item.id === "specs" && specCount > 0 && (
                <span className="ml-auto rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {specCount}
                </span>
              )}
              {item.id === "workflows" && workflowCount > 0 && (
                <span className="ml-auto rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {workflowCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3 text-xs text-zinc-500">
        <div>{configs.length} agents configured</div>
        <div>{sessions.size} total sessions</div>
      </div>
    </aside>
  );
}
