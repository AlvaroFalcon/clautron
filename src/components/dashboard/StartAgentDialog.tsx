import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Play, X } from "lucide-react";
import type { AgentConfig } from "../../lib/types";
import { useAgentStore } from "../../stores/agentStore";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartAgentDialog({ open, onOpenChange }: Props) {
  const configs = useAgentStore((s) => s.configs);
  const startAgent = useAgentStore((s) => s.startAgent);

  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("opus");
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    if (!selectedAgent || !prompt.trim()) return;

    setIsStarting(true);
    try {
      await startAgent(selectedAgent.name, model, prompt.trim());
      toast.success(`Agent "${selectedAgent.name}" started`);
      setPrompt("");
      setSelectedAgent(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(`Failed to start agent: ${err}`);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-surface-1 p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-zinc-100">
              Start Agent
            </Dialog.Title>
            <Dialog.Close className="rounded p-1 text-zinc-500 hover:bg-surface-2 hover:text-zinc-300">
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Agent selection */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Agent
            </label>
            {configs.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No agents configured. Add agent definitions to{" "}
                <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">
                  .claude/agents/
                </code>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {configs.map((config) => (
                  <button
                    key={config.name}
                    onClick={() => {
                      setSelectedAgent(config);
                      setModel(config.model || "opus");
                    }}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                      selectedAgent?.name === config.name
                        ? "border-blue-500 bg-blue-500/10 text-zinc-100"
                        : "border-zinc-700 bg-surface-2 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: `var(--color-agent-${config.color || "blue"})`,
                      }}
                    />
                    <div>
                      <div className="font-medium">{config.name}</div>
                      {config.description && (
                        <div className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                          {config.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model selector */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-surface-2 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              <option value="opus">Claude Opus</option>
              <option value="sonnet">Claude Sonnet</option>
              <option value="haiku">Claude Haiku</option>
            </select>
          </div>

          {/* Prompt */}
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the task for this agent..."
              rows={4}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-surface-2 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Dialog.Close className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-surface-2 hover:text-zinc-200">
              Cancel
            </Dialog.Close>
            <button
              onClick={handleStart}
              disabled={!selectedAgent || !prompt.trim() || isStarting}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={14} />
              {isStarting ? "Starting..." : "Start Agent"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
