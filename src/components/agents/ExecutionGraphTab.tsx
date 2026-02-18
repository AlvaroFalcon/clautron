import { memo, useMemo, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import {
  Bot,
  Terminal,
  FileText,
  Pencil,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Maximize2,
} from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import {
  buildExecutionGraph,
  type ExecutionGraphNode,
  type ExecutionNodeType,
} from "../../lib/logParser";
import type { AgentSession } from "../../lib/types";

// --- Layout constants ---

const NODE_WIDTH = 300;
const NODE_VERTICAL_GAP = 14;

const NODE_HEIGHTS: Record<ExecutionNodeType, number> = {
  "session-root": 108,
  task: 86,
  bash: 66,
  "file-write": 46,
  "file-read-cluster": 58,
  result: 86,
};

const HANDLE_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "#52525b",
  border: "2px solid #3f3f46",
  borderRadius: "50%",
};

// --- Node components ---

const SessionRootNode = memo(function SessionRootNode({ data }: NodeProps) {
  const d = data as unknown as ExecutionGraphNode;
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="rounded-xl border border-blue-500/40 bg-blue-950/25 p-3.5 shadow-lg"
    >
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-900/60">
          <Bot size={12} className="text-blue-400" />
        </div>
        <span className="truncate text-sm font-semibold text-zinc-100">
          {d.agentName}
        </span>
        <span className="ml-auto flex-shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
          {d.model}
        </span>
      </div>
      <p className="line-clamp-3 text-[11px] leading-relaxed text-zinc-400">
        {d.prompt}
      </p>
    </div>
  );
});

const TaskGraphNode = memo(function TaskGraphNode({ data }: NodeProps) {
  const d = data as unknown as ExecutionGraphNode;
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 shadow-md"
    >
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      <div className="mb-1.5 flex items-center gap-1.5">
        <Cpu size={12} className="flex-shrink-0 text-amber-400" />
        <span className="text-xs font-semibold text-amber-300">
          Sub-agent spawned
        </span>
      </div>
      <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
        {d.taskDescription || d.taskPrompt || "—"}
      </p>
    </div>
  );
});

const BashGraphNode = memo(function BashGraphNode({ data }: NodeProps) {
  const d = data as unknown as ExecutionGraphNode;
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 shadow-md"
    >
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      <div className="mb-1 flex items-center gap-1.5">
        <Terminal size={11} className="flex-shrink-0 text-emerald-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
          Bash
        </span>
      </div>
      <code className="block break-all font-mono text-[11px] leading-relaxed text-zinc-400 line-clamp-2">
        {d.command}
      </code>
    </div>
  );
});

const FileWriteGraphNode = memo(function FileWriteGraphNode({
  data,
}: NodeProps) {
  const d = data as unknown as ExecutionGraphNode;
  const toolLower = (d.writeToolName || "").toLowerCase();
  const isEdit =
    toolLower.startsWith("edit") || toolLower.startsWith("multi");
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="rounded-lg border border-purple-700/40 bg-purple-950/15 px-3 py-2 shadow-md"
    >
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      <div className="flex min-w-0 items-center gap-2">
        {isEdit ? (
          <Pencil size={11} className="flex-shrink-0 text-purple-400" />
        ) : (
          <FileText size={11} className="flex-shrink-0 text-purple-400" />
        )}
        <span className="flex-shrink-0 text-xs font-medium text-purple-300">
          {isEdit ? "Edit" : "Write"}
        </span>
        <span className="truncate font-mono text-[11px] text-zinc-500">
          {d.filePath}
        </span>
      </div>
    </div>
  );
});

const FileReadClusterGraphNode = memo(function FileReadClusterGraphNode({
  data,
}: NodeProps) {
  const d = data as unknown as ExecutionGraphNode;
  const [expanded, setExpanded] = useState(false);
  const files = d.readFiles ?? [];
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-2 shadow-md"
    >
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      <button
        className="flex w-full items-center gap-1.5 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <FolderOpen size={11} className="flex-shrink-0 text-zinc-500" />
        <span className="text-[11px] text-zinc-500">
          Read {files.length} file{files.length !== 1 ? "s" : ""}
        </span>
        {expanded ? (
          <ChevronUp size={10} className="ml-auto text-zinc-600" />
        ) : (
          <ChevronDown size={10} className="ml-auto text-zinc-600" />
        )}
      </button>
      {expanded && files.length > 0 && (
        <div className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto">
          {files.map((f, i) => (
            <div
              key={i}
              className="truncate font-mono text-[10px] text-zinc-600"
            >
              {f || "—"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const ResultGraphNode = memo(function ResultGraphNode({ data }: NodeProps) {
  const d = data as unknown as ExecutionGraphNode;
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className={`rounded-xl border p-3 shadow-lg ${
        d.isError
          ? "border-red-500/40 bg-red-950/20"
          : "border-emerald-500/40 bg-emerald-950/20"
      }`}
    >
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <div className="mb-1.5 flex items-center gap-2">
        {d.isError ? (
          <AlertTriangle size={13} className="text-red-400" />
        ) : (
          <CheckCircle2 size={13} className="text-emerald-400" />
        )}
        <span
          className={`text-xs font-semibold ${
            d.isError ? "text-red-300" : "text-emerald-300"
          }`}
        >
          {d.isError ? "Error" : "Completed"}
        </span>
      </div>
      {d.resultText && (
        <p className="line-clamp-3 text-[11px] leading-relaxed text-zinc-400">
          {d.resultText}
        </p>
      )}
    </div>
  );
});

// nodeTypes must be defined outside component to prevent re-renders
const NODE_TYPES: NodeTypes = {
  "session-root": SessionRootNode,
  task: TaskGraphNode,
  bash: BashGraphNode,
  "file-write": FileWriteGraphNode,
  "file-read-cluster": FileReadClusterGraphNode,
  result: ResultGraphNode,
};

// --- Layout helpers ---

function toFlowNodes(graphNodes: ExecutionGraphNode[]): Node[] {
  let y = 0;
  return graphNodes.map((gn) => {
    const h = NODE_HEIGHTS[gn.nodeType] ?? 80;
    const node: Node = {
      id: gn.id,
      type: gn.nodeType,
      position: { x: 0, y },
      data: gn as unknown as Record<string, unknown>,
      draggable: false,
      selectable: false,
    };
    y += h + NODE_VERTICAL_GAP;
    return node;
  });
}

function toFlowEdges(
  edges: Array<{ id: string; source: string; target: string }>,
): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    style: { stroke: "#3f3f46", strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#3f3f46",
      width: 14,
      height: 14,
    },
  }));
}

// --- Inner graph (needs ReactFlowProvider in parent) ---

function ExecutionGraphInner({
  session,
  sessionLogs,
}: {
  session: AgentSession;
  sessionLogs: Array<{
    session_id: string;
    message_type: string;
    content: string;
    timestamp: string;
  }>;
}) {
  const { fitView } = useReactFlow();

  const graphData = useMemo(
    () => buildExecutionGraph(sessionLogs, session),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionLogs.length, session.id, session.status],
  );

  const flowNodes = useMemo(
    () => toFlowNodes(graphData.nodes),
    [graphData.nodes],
  );
  const flowEdges = useMemo(
    () => toFlowEdges(graphData.edges),
    [graphData.edges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(toFlowNodes(graphData.nodes));
    setEdges(toFlowEdges(graphData.edges));
  }, [graphData, setNodes, setEdges]);

  // Fit view whenever node count changes (new nodes added during live run)
  useEffect(() => {
    fitView({ duration: 400, padding: 0.18 });
  }, [nodes.length, fitView]);

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">
        Waiting for session to start…
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <button
        onClick={() => fitView({ duration: 400, padding: 0.18 })}
        className="absolute right-12 top-2 z-10 flex items-center gap-1 rounded border border-zinc-700 bg-surface-1 px-2 py-1 text-[10px] text-zinc-400 hover:bg-surface-2"
        title="Fit view"
      >
        <Maximize2 size={10} />
        Fit
      </button>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        nodesConnectable={false}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#27272a"
        />
        <Controls className="!border-zinc-700 !bg-surface-1 [&>button]:!border-zinc-700 [&>button]:!bg-surface-1 [&>button]:!fill-zinc-400 [&>button:hover]:!bg-surface-2" />
      </ReactFlow>
    </div>
  );
}

// --- Public component ---

interface Props {
  session: AgentSession;
}

export function ExecutionGraphTab({ session }: Props) {
  const logs = useAgentStore((s) => s.logs);
  const sessionLogs = logs.get(session.id) ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ReactFlowProvider>
        <ExecutionGraphInner session={session} sessionLogs={sessionLogs} />
      </ReactFlowProvider>
    </div>
  );
}
