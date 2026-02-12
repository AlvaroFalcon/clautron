import { memo } from "react";
import { Search, X } from "lucide-react";

export interface LogFilterState {
  types: Set<string>;
  search: string;
}

const MESSAGE_TYPES = [
  { key: "system", label: "System", color: "text-zinc-400" },
  { key: "assistant", label: "Assistant", color: "text-zinc-200" },
  { key: "user", label: "Tool Results", color: "text-emerald-400" },
  { key: "result", label: "Result", color: "text-amber-300" },
  { key: "stderr", label: "Stderr", color: "text-red-400" },
];

interface Props {
  filter: LogFilterState;
  onFilterChange: (filter: LogFilterState) => void;
  totalCount: number;
  filteredCount: number;
}

export const LogFilter = memo(function LogFilter({
  filter,
  onFilterChange,
  totalCount,
  filteredCount,
}: Props) {
  const toggleType = (type: string) => {
    const next = new Set(filter.types);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onFilterChange({ ...filter, types: next });
  };

  const setSearch = (search: string) => {
    onFilterChange({ ...filter, search });
  };

  return (
    <div className="flex items-center gap-3 border-b border-zinc-800 px-3 py-2">
      {/* Type filter toggles */}
      <div className="flex items-center gap-1">
        {MESSAGE_TYPES.map((t) => {
          const active = filter.types.has(t.key);
          return (
            <button
              key={t.key}
              onClick={() => toggleType(t.key)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                active
                  ? `${t.color} bg-zinc-800`
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
              title={`${active ? "Hide" : "Show"} ${t.label} messages`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-zinc-800" />

      {/* Search */}
      <div className="flex flex-1 items-center gap-1.5 rounded border border-zinc-800 bg-surface-0 px-2 py-1">
        <Search size={12} className="flex-shrink-0 text-zinc-600" />
        <input
          type="text"
          value={filter.search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter logs..."
          className="flex-1 bg-transparent text-xs text-zinc-300 placeholder:text-zinc-600 outline-none"
        />
        {filter.search && (
          <button
            onClick={() => setSearch("")}
            className="text-zinc-600 hover:text-zinc-400"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Count */}
      <span className="flex-shrink-0 text-[10px] text-zinc-600">
        {filteredCount === totalCount
          ? `${totalCount}`
          : `${filteredCount}/${totalCount}`}
      </span>
    </div>
  );
});
