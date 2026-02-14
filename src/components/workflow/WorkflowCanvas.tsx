import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  BackgroundVariant,
} from "@xyflow/react";
import { Plus, Play, Square } from "lucide-react";
import { AgentNode, type AgentNodeData } from "./AgentNode";
import { useWorkflowStore } from "../../stores/workflowStore";
import { useAgentStore } from "../../stores/agentStore";
import type { WorkflowStep, WorkflowEdge as WFEdge } from "../../lib/types";
import { toast } from "sonner";

const nodeTypes: NodeTypes = {
  agent: AgentNode,
};

interface Props {
  workflowId: string;
  onNodeSelect: (stepId: string | null) => void;
}

function stepsToNodes(steps: WorkflowStep[]): Node[] {
  return steps.map((step) => ({
    id: step.id,
    type: "agent",
    position: { x: step.position_x, y: step.position_y },
    data: {
      label: step.agent_name,
      agentName: step.agent_name,
      model: step.model,
      prompt: step.prompt,
      status: step.status,
      stepId: step.id,
    } satisfies AgentNodeData,
  }));
}

function wfEdgesToEdges(wfEdges: WFEdge[]): Edge[] {
  return wfEdges.map((e) => ({
    id: e.id,
    source: e.source_step_id,
    target: e.target_step_id,
    animated: false,
    style: { stroke: "#52525b", strokeWidth: 2 },
  }));
}

export function WorkflowCanvas({ workflowId, onNodeSelect }: Props) {
  const storeSteps = useWorkflowStore((s) => s.steps.get(workflowId) ?? []);
  const storeEdges = useWorkflowStore((s) => s.edges.get(workflowId) ?? []);
  const workflows = useWorkflowStore((s) => s.workflows);
  const addStepAction = useWorkflowStore((s) => s.addStep);
  const updateStep = useWorkflowStore((s) => s.updateStep);
  const removeStepAction = useWorkflowStore((s) => s.removeStep);
  const addEdgeAction = useWorkflowStore((s) => s.addEdge);
  const removeEdgeAction = useWorkflowStore((s) => s.removeEdge);
  const startWorkflowAction = useWorkflowStore((s) => s.startWorkflow);
  const stopWorkflowAction = useWorkflowStore((s) => s.stopWorkflow);
  const validateWorkflowAction = useWorkflowStore((s) => s.validateWorkflow);
  const configs = useAgentStore((s) => s.configs);

  const workflow = workflows.find((w) => w.id === workflowId);
  const isRunning = workflow?.status === "running";

  const initialNodes = useMemo(() => stepsToNodes(storeSteps), [storeSteps]);
  const initialEdges = useMemo(() => wfEdgesToEdges(storeEdges), [storeEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync store changes to local state when steps/edges change from events
  useEffect(() => {
    setNodes(stepsToNodes(storeSteps));
  }, [storeSteps, setNodes]);

  useEffect(() => {
    setEdges(wfEdgesToEdges(storeEdges));
  }, [storeEdges, setEdges]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      try {
        await addEdgeAction(workflowId, connection.source, connection.target);
      } catch (e) {
        toast.error(`Failed to add edge: ${e}`);
      }
    },
    [workflowId, addEdgeAction],
  );

  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      const step = storeSteps.find((s) => s.id === node.id);
      if (step) {
        await updateStep({
          ...step,
          position_x: node.position.x,
          position_y: node.position.y,
        });
      }
    },
    [storeSteps, updateStep],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      if (selectedNodes.length === 1) {
        onNodeSelect(selectedNodes[0].id);
      } else {
        onNodeSelect(null);
      }
    },
    [onNodeSelect],
  );

  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        await removeEdgeAction(edge.id, workflowId);
      }
    },
    [workflowId, removeEdgeAction],
  );

  const onNodesDelete = useCallback(
    async (deletedNodes: Node[]) => {
      for (const node of deletedNodes) {
        await removeStepAction(node.id, workflowId);
      }
    },
    [workflowId, removeStepAction],
  );

  const handleAddStep = async () => {
    const defaultAgent = configs[0];
    if (!defaultAgent) {
      toast.error("No agents configured");
      return;
    }

    // Place new node at a reasonable position
    const offsetX = storeSteps.length * 50;
    const offsetY = storeSteps.length * 80;

    await addStepAction(
      workflowId,
      defaultAgent.name,
      defaultAgent.model || "sonnet",
      "",
      200 + offsetX,
      100 + offsetY,
    );
  };

  const handleStart = async () => {
    try {
      await validateWorkflowAction(workflowId);
      await startWorkflowAction(workflowId);
      toast.success("Workflow started");
    } catch (e) {
      toast.error(`Failed to start workflow: ${e}`);
    }
  };

  const handleStop = async () => {
    try {
      await stopWorkflowAction(workflowId);
      toast.info("Workflow stopped");
    } catch (e) {
      toast.error(`Failed to stop workflow: ${e}`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <button
          onClick={handleAddStep}
          disabled={isRunning}
          className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          <Plus size={13} />
          Add Step
        </button>

        <div className="flex-1" />

        {workflow && (
          <span className="mr-2 text-xs text-zinc-500">
            {workflow.name}
          </span>
        )}

        {isRunning ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
          >
            <Square size={12} />
            Stop
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={storeSteps.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
          >
            <Play size={12} />
            Run
          </button>
        )}
      </div>

      {/* Canvas */}
      <div style={{ width: "100%", flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          onEdgesDelete={onEdgesDelete}
          onNodesDelete={onNodesDelete}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Backspace"
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
        </ReactFlow>
      </div>
    </div>
  );
}
