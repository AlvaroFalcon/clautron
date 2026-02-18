import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AGENT_COLORS, AGENT_COLOR_OPTIONS } from "../../lib/types";

export interface RelationshipNodeData {
  agentName: string;
  model: string;
  description: string;
  color: string;
  isRunning: boolean;
  activeSessionCount: number;
  [key: string]: unknown;
}

function getColorHex(color: string): string {
  return AGENT_COLORS[color] ?? AGENT_COLOR_OPTIONS.find((c) => c.value === color)?.hex ?? "#71717a";
}

export const RelationshipNode = memo(function RelationshipNode({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as unknown as RelationshipNodeData;
  const colorHex = getColorHex(nodeData.color);

  return (
    <div
      className={`w-[220px] rounded-lg border bg-surface-1 shadow-lg transition-all ${
        selected
          ? "border-blue-500 ring-1 ring-blue-500/30"
          : "border-zinc-700"
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: colorHex }}
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
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="relative flex-shrink-0">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: colorHex }}
          />
          {nodeData.isRunning && (
            <div
              className="absolute inset-0 h-3 w-3 animate-ping rounded-full opacity-75"
              style={{ backgroundColor: colorHex }}
            />
          )}
        </div>
        <span className="flex-1 truncate text-xs font-semibold text-zinc-100">
          {nodeData.agentName}
        </span>
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-zinc-400">
          {nodeData.model}
        </span>
      </div>

      {/* Description */}
      {nodeData.description && (
        <div className="border-t border-zinc-800 px-3 py-2">
          <p className="line-clamp-2 text-[11px] text-zinc-400">
            {nodeData.description.length > 100
              ? nodeData.description.slice(0, 100) + "..."
              : nodeData.description}
          </p>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              nodeData.isRunning ? "bg-green-400" : "bg-zinc-600"
            }`}
          />
          <span className="text-[10px] text-zinc-500">
            {nodeData.isRunning ? "Active" : "Inactive"}
          </span>
        </div>
        {nodeData.activeSessionCount > 0 && (
          <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[9px] font-medium text-green-400">
            {nodeData.activeSessionCount} session{nodeData.activeSessionCount !== 1 ? "s" : ""}
          </span>
        )}
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
