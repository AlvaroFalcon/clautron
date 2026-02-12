import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ShieldAlert, Check, X } from "lucide-react";
import type { UnapprovedAgent } from "../../lib/types";

interface AgentApprovalDialogProps {
  agents: UnapprovedAgent[];
  onApprove: (agents: UnapprovedAgent[]) => void;
  onReject: () => void;
}

export function AgentApprovalDialog({
  agents,
  onApprove,
  onReject,
}: AgentApprovalDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(agents.map((a) => a.file_path)),
  );

  function toggleAgent(filePath: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }

  function handleApprove() {
    const approved = agents.filter((a) => selected.has(a.file_path));
    if (approved.length > 0) {
      onApprove(approved);
    }
  }

  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-surface-1 p-6 shadow-xl">
          <div className="flex items-center gap-3 text-amber-400">
            <ShieldAlert size={24} />
            <Dialog.Title className="text-lg font-semibold text-zinc-100">
              Agent Approval Required
            </Dialog.Title>
          </div>

          <Dialog.Description className="mt-2 text-sm text-zinc-400">
            The following agent definitions were found in this project. Review
            and approve them before they can be used.
          </Dialog.Description>

          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
            {agents.map((agent) => (
              <label
                key={agent.file_path}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-700 p-3 transition-colors hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={selected.has(agent.file_path)}
                  onChange={() => toggleAgent(agent.file_path)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-surface-0 text-blue-500 accent-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-100">
                      {agent.name}
                    </span>
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-zinc-400">
                      {agent.model}
                    </span>
                  </div>
                  {agent.description && (
                    <p className="mt-0.5 text-xs text-zinc-500 truncate">
                      {agent.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs font-mono text-zinc-600 truncate">
                    {agent.file_path}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onReject}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-surface-2"
            >
              <X size={14} />
              Skip
            </button>
            <button
              onClick={handleApprove}
              disabled={selected.size === 0}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              <Check size={14} />
              Approve {selected.size > 0 ? `(${selected.size})` : ""}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
