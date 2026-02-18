import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowLeft,
  MessageSquare,
  Wrench,
  FolderOpen,
  Info,
  Square,
  GitBranch,
  Network,
} from "lucide-react";
import type { AgentSession } from "../../lib/types";
import { AGENT_COLORS } from "../../lib/types";
import { AgentStatusBadge } from "../dashboard/AgentStatusBadge";
import { useAgentStore } from "../../stores/agentStore";
import { ConversationTab } from "./ConversationTab";
import { ToolsTab } from "./ToolsTab";
import { FilesTab } from "./FilesTab";
import { InfoTab } from "./InfoTab";
import { ReviewPanel } from "../review/ReviewPanel";
import { ExecutionGraphTab } from "./ExecutionGraphTab";

interface Props {
  session: AgentSession;
  onBack: () => void;
}

const TAB_ITEMS = [
  { value: "conversation", label: "Conversation", icon: MessageSquare },
  { value: "tools", label: "Tools", icon: Wrench },
  { value: "files", label: "Files", icon: FolderOpen },
  { value: "graph", label: "Graph", icon: Network },
  { value: "review", label: "Review", icon: GitBranch },
  { value: "info", label: "Info", icon: Info },
];

export function AgentDetailPanel({ session, onBack }: Props) {
  const stopAgent = useAgentStore((s) => s.stopAgent);

  const isActive =
    session.status === "running" || session.status === "starting";

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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-zinc-800 px-4">
        <button
          onClick={onBack}
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-surface-2 hover:text-zinc-300"
          title="Back to dashboard"
        >
          <ArrowLeft size={16} />
        </button>

        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: agentColor }}
        />

        <span className="text-sm font-medium text-zinc-100">
          {session.agent_name}
        </span>

        <AgentStatusBadge status={session.status} />

        <div className="flex-1" />

        {isActive && (
          <button
            onClick={() => stopAgent(session.id)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-red-900/30 hover:text-red-400"
          >
            <Square size={12} />
            Stop
          </button>
        )}
      </div>

      {/* Tabs */}
      <Tabs.Root defaultValue="conversation" className="flex flex-1 flex-col overflow-hidden">
        <Tabs.List className="flex flex-shrink-0 border-b border-zinc-800">
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            return (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300 data-[state=active]:border-blue-500 data-[state=active]:text-zinc-100"
              >
                <Icon size={13} />
                {tab.label}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        <Tabs.Content value="conversation" className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ConversationTab sessionId={session.id} />
        </Tabs.Content>

        <Tabs.Content value="tools" className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ToolsTab sessionId={session.id} />
        </Tabs.Content>

        <Tabs.Content value="files" className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <FilesTab sessionId={session.id} />
        </Tabs.Content>

        <Tabs.Content value="graph" className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ExecutionGraphTab session={session} />
        </Tabs.Content>

        <Tabs.Content value="review" className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ReviewPanel session={session} />
        </Tabs.Content>

        <Tabs.Content value="info" className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <InfoTab session={session} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
