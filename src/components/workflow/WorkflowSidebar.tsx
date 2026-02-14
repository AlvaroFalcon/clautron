import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useWorkflowStore } from "../../stores/workflowStore";
import { useAgentStore } from "../../stores/agentStore";
import { WORKFLOW_STATUS_COLORS } from "../../lib/types";

interface Props {
  workflowId: string;
  selectedStepId: string | null;
}

export function WorkflowSidebar({ workflowId, selectedStepId }: Props) {
  const workflows = useWorkflowStore((s) => s.workflows);
  const steps = useWorkflowStore((s) => s.steps.get(workflowId) ?? []);
  const updateStep = useWorkflowStore((s) => s.updateStep);
  const removeStep = useWorkflowStore((s) => s.removeStep);
  const configs = useAgentStore((s) => s.configs);

  const workflow = workflows.find((w) => w.id === workflowId);
  const selectedStep = selectedStepId
    ? steps.find((s) => s.id === selectedStepId)
    : null;

  // Local form state for step editing
  const [agentName, setAgentName] = useState("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [passContext, setPassContext] = useState(false);

  useEffect(() => {
    if (selectedStep) {
      setAgentName(selectedStep.agent_name);
      setModel(selectedStep.model);
      setPrompt(selectedStep.prompt);
      // Guard: pass_context may be missing on older data; never set undefined for controlled checkbox
      setPassContext(Boolean(selectedStep.pass_context));
    }
  }, [selectedStep]);

  const handleSaveStep = async () => {
    if (!selectedStep) return;
    await updateStep({
      ...selectedStep,
      agent_name: agentName,
      model,
      prompt,
      pass_context: passContext,
    });
  };

  const handleDeleteStep = async () => {
    if (!selectedStep) return;
    await removeStep(selectedStep.id, workflowId);
  };

  if (!workflow) return null;

  const statusColor =
    WORKFLOW_STATUS_COLORS[workflow.status] ?? "#71717a";

  // Step editing panel
  if (selectedStep) {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-medium text-zinc-100">Edit Step</h3>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* Agent */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Agent
            </label>
            <select
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-surface-0 px-3 py-2 text-sm text-zinc-100 focus:border-blue-600 focus:outline-none"
            >
              {configs.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-surface-0 px-3 py-2 text-sm text-zinc-100 focus:border-blue-600 focus:outline-none"
            >
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
          </div>

          {/* Prompt */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-zinc-700 bg-surface-0 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-600 focus:outline-none"
              placeholder="Instructions for this step..."
            />
          </div>

          {/* Pass Context */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="passContext"
              checked={passContext}
              onChange={(e) => setPassContext(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-surface-0"
            />
            <label htmlFor="passContext" className="text-[11px] text-zinc-400">
              Pass context from parent steps
            </label>
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Status
            </label>
            <p className="text-sm text-zinc-300">{selectedStep.status}</p>
            {selectedStep.session_id && (
              <p className="mt-1 font-mono text-[10px] text-zinc-500">
                Session: {selectedStep.session_id.slice(0, 8)}...
              </p>
            )}
          </div>

          {/* Result Output (shown when step has completed with output) */}
          {selectedStep.result_output && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                Output
              </label>
              <pre className="max-h-32 overflow-auto rounded bg-surface-0 p-2 text-[10px] text-zinc-400">
                {selectedStep.result_output.slice(0, 500)}
                {selectedStep.result_output.length > 500 && "..."}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveStep}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500"
            >
              Save
            </button>
            <button
              onClick={handleDeleteStep}
              className="rounded-lg border border-red-800/50 p-2 text-red-400 transition-colors hover:bg-red-900/30"
              title="Delete step"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Workflow overview panel
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-medium text-zinc-100">Workflow</h3>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-400">
            Name
          </label>
          <p className="text-sm text-zinc-200">{workflow.name}</p>
        </div>

        {workflow.description && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Description
            </label>
            <p className="text-sm text-zinc-300">{workflow.description}</p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-400">
            Status
          </label>
          <span
            className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor,
            }}
          >
            {workflow.status}
          </span>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-400">
            Steps
          </label>
          <p className="text-sm text-zinc-300">{steps.length} step(s)</p>
        </div>

        <div className="text-[11px] text-zinc-600">
          Select a node on the canvas to edit it.
        </div>
      </div>
    </div>
  );
}
