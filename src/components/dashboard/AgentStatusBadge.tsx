import { memo } from "react";
import type { AgentStatus } from "../../lib/types";
import { formatStatus } from "../../lib/formatters";

const STATUS_STYLES: Record<AgentStatus, string> = {
  idle: "bg-zinc-700 text-zinc-300",
  starting: "bg-yellow-900/50 text-yellow-400",
  running: "bg-blue-900/50 text-blue-400",
  completed: "bg-green-900/50 text-green-400",
  error: "bg-red-900/50 text-red-400",
  stopped: "bg-zinc-700 text-zinc-400",
};

interface Props {
  status: AgentStatus;
}

export const AgentStatusBadge = memo(function AgentStatusBadge({
  status,
}: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {(status === "running" || status === "starting") && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {formatStatus(status)}
    </span>
  );
});
