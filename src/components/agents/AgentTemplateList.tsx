import { useState } from "react";
import { Plus, Bot, Trash2 } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import type { AgentConfig } from "../../lib/types";
import { AGENT_COLORS, AGENT_COLOR_OPTIONS } from "../../lib/types";

export function AgentTemplateList() {
  const configs = useAgentStore((s) => s.configs);
  const selectedAgentPath = useAgentStore((s) => s.selectedAgentPath);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const createAgent = useAgentStore((s) => s.createAgent);
  const deleteAgent = useAgentStore((s) => s.deleteAgent);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newModel, setNewModel] = useState("sonnet");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState("blue");

  async function handleCreate() {
    if (!newName.trim()) return;
    await createAgent(newName.trim(), newModel, newDescription.trim(), newColor);
    setNewName("");
    setNewDescription("");
    setCreating(false);
  }

  function getColorHex(color: string): string {
    return AGENT_COLORS[color] ?? AGENT_COLOR_OPTIONS.find((c) => c.value === color)?.hex ?? "#71717a";
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">Agent Templates</h2>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Plus size={12} />
          New Agent
        </button>
      </div>

      {/* New agent form */}
      {creating && (
        <div className="border-b border-zinc-800 px-4 py-3 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Agent name..."
            className="w-full rounded border border-zinc-700 bg-surface-2 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="w-full rounded border border-zinc-700 bg-surface-2 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
          />
          <div className="flex items-center gap-2">
            <select
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              className="rounded border border-zinc-700 bg-surface-2 px-2 py-1 text-xs text-zinc-300"
            >
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
            <div className="flex gap-1">
              {AGENT_COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setNewColor(c.value)}
                  className={`h-5 w-5 rounded-full border-2 transition-all ${
                    newColor === c.value
                      ? "border-white scale-110"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              className="rounded px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto">
        {configs.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <Bot size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No agent templates</p>
            <p className="text-xs">Create one to get started</p>
          </div>
        )}

        {configs.map((config) => (
          <AgentRow
            key={config.file_path}
            config={config}
            isSelected={selectedAgentPath === config.file_path}
            onSelect={() => selectAgent(config.file_path)}
            onDelete={() => deleteAgent(config.file_path)}
            getColorHex={getColorHex}
          />
        ))}
      </div>
    </div>
  );
}

function AgentRow({
  config,
  isSelected,
  onSelect,
  onDelete,
  getColorHex,
}: {
  config: AgentConfig;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  getColorHex: (color: string) => string;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isSelected
          ? "bg-surface-2 text-zinc-100"
          : "text-zinc-300 hover:bg-surface-1"
      }`}
    >
      <div
        className="h-3 w-3 flex-shrink-0 rounded-full"
        style={{ backgroundColor: getColorHex(config.color) }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{config.name}</span>
          <span className="flex-shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {config.model}
          </span>
        </div>
        {config.description && (
          <div className="mt-0.5 truncate text-[11px] text-zinc-500">
            {config.description.length > 80
              ? config.description.slice(0, 80) + "..."
              : config.description}
          </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 size={14} className="text-zinc-500 hover:text-red-400" />
      </button>
    </button>
  );
}
