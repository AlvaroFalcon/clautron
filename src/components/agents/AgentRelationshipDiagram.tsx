import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  BackgroundVariant,
} from "@xyflow/react";
import { RefreshCw } from "lucide-react";
import { RelationshipNode, type RelationshipNodeData } from "./RelationshipNode";
import { useAgentStore } from "../../stores/agentStore";
import type { AgentConfig, AgentRelationship } from "../../lib/types";
import * as tauri from "../../lib/tauri";

const nodeTypes: NodeTypes = {
  relationship: RelationshipNode,
};

function layoutNodesInCircle(
  configs: AgentConfig[],
  sessions: Map<string, { agent_name: string; status: string }>,
): Node[] {
  const count = configs.length;
  if (count === 0) return [];

  const centerX = 400;
  const centerY = 300;
  const radius = Math.max(200, count * 50);

  return configs.map((config, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    // Count active sessions for this agent
    const activeSessions = Array.from(sessions.values()).filter(
      (s) =>
        s.agent_name === config.name &&
        (s.status === "running" || s.status === "starting"),
    );

    return {
      id: config.name,
      type: "relationship",
      position: { x, y },
      data: {
        agentName: config.name,
        model: config.model,
        description: config.description,
        color: config.color,
        isRunning: activeSessions.length > 0,
        activeSessionCount: activeSessions.length,
      } satisfies RelationshipNodeData,
    };
  });
}

function relationshipsToEdges(relationships: AgentRelationship[]): Edge[] {
  return relationships.map((rel, i) => {
    const isMulti = rel.edge_count > 1;
    return {
      id: `rel-${i}`,
      source: rel.source_agent,
      target: rel.target_agent,
      animated: false,
      label: rel.workflow_names.join(", "),
      labelStyle: { fontSize: 10, fill: "#a1a1aa" },
      labelBgStyle: { fill: "#18181b", fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      style: {
        stroke: "#52525b",
        strokeWidth: isMulti ? 3 : 2,
      },
    };
  });
}

export function AgentRelationshipDiagram() {
  const configs = useAgentStore((s) => s.configs);
  const sessions = useAgentStore((s) => s.sessions);
  const [relationships, setRelationships] = useState<AgentRelationship[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRelationships = useCallback(async () => {
    setLoading(true);
    try {
      const rels = await tauri.getAgentRelationships();
      setRelationships(rels);
    } catch (e) {
      console.error("Failed to fetch relationships:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  const sessionMap = useMemo(() => {
    const map = new Map<string, { agent_name: string; status: string }>();
    sessions.forEach((s, id) => {
      map.set(id, { agent_name: s.agent_name, status: s.status });
    });
    return map;
  }, [sessions]);

  const initialNodes = useMemo(
    () => layoutNodesInCircle(configs, sessionMap),
    [configs, sessionMap],
  );
  const initialEdges = useMemo(
    () => relationshipsToEdges(relationships),
    [relationships],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when configs/sessions/relationships change
  useEffect(() => {
    setNodes(layoutNodesInCircle(configs, sessionMap));
  }, [configs, sessionMap, setNodes]);

  useEffect(() => {
    setEdges(relationshipsToEdges(relationships));
  }, [relationships, setEdges]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <span className="text-xs text-zinc-400">
          {configs.length} agent{configs.length !== 1 ? "s" : ""}
          {relationships.length > 0 &&
            ` \u00b7 ${relationships.length} relationship${relationships.length !== 1 ? "s" : ""}`}
        </span>
        <div className="flex-1" />
        <button
          onClick={fetchRelationships}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Canvas */}
      <div className="min-h-0 flex-1 w-full" style={{ minHeight: 200 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesConnectable={false}
          deleteKeyCode={null}
          fitView
          proOptions={{ hideAttribution: true }}
          className="bg-surface-0"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#27272a"
          />
          <Controls
            className="!border-zinc-700 !bg-surface-1 [&>button]:!border-zinc-700 [&>button]:!bg-surface-1 [&>button]:!fill-zinc-400 [&>button:hover]:!bg-surface-2"
          />
          <MiniMap
            nodeStrokeColor="#52525b"
            nodeColor="#27272a"
            maskColor="rgba(0,0,0,0.7)"
            className="!border-zinc-700 !bg-surface-1"
          />
          {configs.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-zinc-500">
                No agents configured. Create agent templates to see them here.
              </p>
            </div>
          )}
        </ReactFlow>
      </div>
    </div>
  );
}
