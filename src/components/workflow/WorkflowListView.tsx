import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  GitFork,
  Loader2,
} from "lucide-react";
import { useWorkflowStore } from "../../stores/workflowStore";
import { WORKFLOW_STATUS_COLORS } from "../../lib/types";

interface Props {
  onSelect: (workflowId: string) => void;
}

export function WorkflowListView({ onSelect }: Props) {
  const workflows = useWorkflowStore((s) => s.workflows);
  const loading = useWorkflowStore((s) => s.loading);
  const loadWorkflows = useWorkflowStore((s) => s.loadWorkflows);
  const createWorkflow = useWorkflowStore((s) => s.createWorkflow);
  const deleteWorkflow = useWorkflowStore((s) => s.deleteWorkflow);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const wf = await createWorkflow(
      newName.trim(),
      newDescription.trim() || undefined,
    );
    setNewName("");
    setNewDescription("");
    setShowCreate(false);
    onSelect(wf.id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteWorkflow(id);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-medium text-zinc-100">Workflows</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-surface-2"
        >
          <Plus size={13} />
          New
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border-b border-zinc-800 p-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Workflow name..."
            className="mb-2 w-full rounded-lg border border-zinc-700 bg-surface-0 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-600 focus:outline-none"
            autoFocus
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="mb-3 w-full rounded-lg border border-zinc-700 bg-surface-0 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-600 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Workflow list */}
      <div className="flex-1 overflow-y-auto">
        {workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <GitFork size={32} className="text-zinc-700" />
            <p className="text-sm text-zinc-500">No workflows yet</p>
            <p className="text-xs text-zinc-600">
              Create a workflow to orchestrate agents
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {workflows.map((wf) => {
              const statusColor =
                WORKFLOW_STATUS_COLORS[wf.status] ?? "#71717a";
              return (
                <button
                  key={wf.id}
                  onClick={() => onSelect(wf.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <GitFork size={16} className="flex-shrink-0 text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-200">
                      {wf.name}
                    </div>
                    {wf.description && (
                      <div className="truncate text-[11px] text-zinc-500">
                        {wf.description}
                      </div>
                    )}
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${statusColor}20`,
                      color: statusColor,
                    }}
                  >
                    {wf.status}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, wf.id)}
                    className="flex-shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-red-900/30 hover:text-red-400"
                    title="Delete workflow"
                  >
                    <Trash2 size={13} />
                  </button>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
