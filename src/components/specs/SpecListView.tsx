import { useState } from "react";
import { Plus, FileText, Trash2 } from "lucide-react";
import { useSpecStore } from "../../stores/specStore";
import type { Spec, SpecPriority, SpecStatus } from "../../lib/types";
import {
  SPEC_STATUS_COLORS,
  SPEC_STATUS_LABELS,
  SPEC_PRIORITY_COLORS,
} from "../../lib/types";

const STATUS_ORDER: SpecStatus[] = [
  "in_progress",
  "assigned",
  "review",
  "draft",
  "done",
  "rejected",
];

export function SpecListView() {
  const specs = useSpecStore((s) => s.specs);
  const selectedSpecPath = useSpecStore((s) => s.selectedSpecPath);
  const selectSpec = useSpecStore((s) => s.selectSpec);
  const createSpec = useSpecStore((s) => s.createSpec);
  const deleteSpec = useSpecStore((s) => s.deleteSpec);

  const [filterPriority, setFilterPriority] = useState<SpecPriority | "all">(
    "all",
  );
  const [filterStatus, setFilterStatus] = useState<SpecStatus | "all">("all");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<SpecPriority>("p1");

  const filtered = specs.filter((s) => {
    if (filterPriority !== "all" && s.priority !== filterPriority) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

  // Group by status
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    specs: filtered.filter((s) => s.status === status),
  })).filter((g) => g.specs.length > 0);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    await createSpec(newTitle.trim(), newPriority);
    setNewTitle("");
    setCreating(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">Specs</h2>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Plus size={12} />
          New Spec
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 border-b border-zinc-800 px-4 py-2">
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as SpecStatus | "all")
          }
          className="rounded border border-zinc-700 bg-surface-2 px-2 py-1 text-xs text-zinc-300"
        >
          <option value="all">All Status</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {SPEC_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) =>
            setFilterPriority(e.target.value as SpecPriority | "all")
          }
          className="rounded border border-zinc-700 bg-surface-2 px-2 py-1 text-xs text-zinc-300"
        >
          <option value="all">All Priority</option>
          <option value="p0">P0</option>
          <option value="p1">P1</option>
          <option value="p2">P2</option>
        </select>
      </div>

      {/* New spec form */}
      {creating && (
        <div className="border-b border-zinc-800 px-4 py-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Spec title..."
            className="mb-2 w-full rounded border border-zinc-700 bg-surface-2 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <div className="flex items-center gap-2">
            <select
              value={newPriority}
              onChange={(e) =>
                setNewPriority(e.target.value as SpecPriority)
              }
              className="rounded border border-zinc-700 bg-surface-2 px-2 py-1 text-xs text-zinc-300"
            >
              <option value="p0">P0</option>
              <option value="p1">P1</option>
              <option value="p2">P2</option>
            </select>
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

      {/* Spec list */}
      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <FileText size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No specs yet</p>
            <p className="text-xs">Create one to get started</p>
          </div>
        )}

        {grouped.map(({ status, specs: groupSpecs }) => (
          <div key={status}>
            <div className="sticky top-0 z-10 bg-surface-0 px-4 py-1.5">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: SPEC_STATUS_COLORS[status] }}
              >
                {SPEC_STATUS_LABELS[status]} ({groupSpecs.length})
              </span>
            </div>
            {groupSpecs.map((spec) => (
              <SpecRow
                key={spec.file_path}
                spec={spec}
                isSelected={selectedSpecPath === spec.file_path}
                onSelect={() => selectSpec(spec.file_path)}
                onDelete={() => deleteSpec(spec.file_path)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SpecRow({
  spec,
  isSelected,
  onSelect,
  onDelete,
}: {
  spec: Spec;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
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
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{spec.title}</span>
          <span
            className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
            style={{
              color: SPEC_PRIORITY_COLORS[spec.priority],
              backgroundColor: `${SPEC_PRIORITY_COLORS[spec.priority]}20`,
            }}
          >
            {spec.priority.toUpperCase()}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
          {spec.assigned_agent && <span>{spec.assigned_agent}</span>}
          <span>{new Date(spec.updated_at).toLocaleDateString()}</span>
        </div>
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
