import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StepStatus } from "../../lib/types";
import { STEP_STATUS_COLORS, AGENT_COLORS } from "../../lib/types";

export interface AgentNodeData {
  label: string;
  agentName: string;
  model: string;
  prompt: string;
  status: StepStatus;
  stepId: string;
  [key: string]: unknown;
}

function getAgentColor(name: string): string {
  if (name.includes("architect")) return AGENT_COLORS.red;
  if (name.includes("security")) return AGENT_COLORS.green;
  if (name.includes("orchestrator")) return AGENT_COLORS.yellow;
  return AGENT_COLORS.blue;
}

export const AgentNode = memo(function AgentNode({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as unknown as AgentNodeData;
  const statusColor = STEP_STATUS_COLORS[nodeData.status] ?? "#71717a";
  const agentColor = getAgentColor(nodeData.agentName);
  const isRunning = nodeData.status === "running";

  return (
    <div
      className={`min-w-[180px] rounded-lg border bg-surface-1 shadow-lg transition-all ${
        selected
          ? "border-blue-500 ring-1 ring-blue-500/30"
          : "border-zinc-700"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 10,
          height: 10,
          background: "#a1a1aa",
          border: "2px solid #52525b",
          borderRadius: "50%",
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <div
          className={`h-2.5 w-2.5 rounded-full ${isRunning ? "animate-pulse" : ""}`}
          style={{ backgroundColor: agentColor }}
        />
        <span className="flex-1 truncate text-xs font-medium text-zinc-100">
          {nodeData.agentName}
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase"
          style={{
            backgroundColor: `${statusColor}20`,
            color: statusColor,
          }}
        >
          {nodeData.status}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <div className="mb-1 text-[10px] text-zinc-500">{nodeData.model}</div>
        <p className="line-clamp-2 text-[11px] text-zinc-400">
          {nodeData.prompt || "No prompt set"}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 10,
          height: 10,
          background: "#a1a1aa",
          border: "2px solid #52525b",
          borderRadius: "50%",
        }}
      />
    </div>
  );
});
