import { memo, useState } from "react";
import { ChevronDown, ChevronRight, FilePlus, FileMinus, FileEdit, FileSymlink } from "lucide-react";
import type { FileDiff, DiffLine } from "../../lib/types";
import { CHANGE_TYPE_COLORS } from "../../lib/types";

interface Props {
  diff: FileDiff;
  defaultExpanded?: boolean;
}

const CHANGE_ICONS: Record<string, typeof FileEdit> = {
  modified: FileEdit,
  added: FilePlus,
  deleted: FileMinus,
  renamed: FileSymlink,
};

function DiffLineRow({ line }: { line: DiffLine }) {
  const bgClass =
    line.line_type === "add"
      ? "bg-green-950/40"
      : line.line_type === "remove"
        ? "bg-red-950/40"
        : "";

  const textClass =
    line.line_type === "add"
      ? "text-green-400"
      : line.line_type === "remove"
        ? "text-red-400"
        : "text-zinc-500";

  const prefix =
    line.line_type === "add" ? "+" : line.line_type === "remove" ? "-" : " ";

  return (
    <div className={`flex font-mono text-[12px] leading-5 ${bgClass}`}>
      <span className="inline-block w-12 flex-shrink-0 select-none pr-2 text-right text-zinc-600">
        {line.old_line ?? ""}
      </span>
      <span className="inline-block w-12 flex-shrink-0 select-none pr-2 text-right text-zinc-600">
        {line.new_line ?? ""}
      </span>
      <span className={`flex-1 whitespace-pre-wrap break-all px-2 ${textClass}`}>
        {prefix}
        {line.content}
      </span>
    </div>
  );
}

export const DiffViewer = memo(function DiffViewer({
  diff,
  defaultExpanded = true,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const Icon = CHANGE_ICONS[diff.change_type] ?? FileEdit;
  const color = CHANGE_TYPE_COLORS[diff.change_type] ?? "#f59e0b";

  const additions = diff.hunks.reduce(
    (sum, h) => sum + h.lines.filter((l) => l.line_type === "add").length,
    0,
  );
  const deletions = diff.hunks.reduce(
    (sum, h) => sum + h.lines.filter((l) => l.line_type === "remove").length,
    0,
  );

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      {/* File header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 bg-surface-2 px-3 py-2 text-left transition-colors hover:bg-zinc-800/80"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-zinc-500" />
        ) : (
          <ChevronRight size={14} className="text-zinc-500" />
        )}
        <Icon size={14} style={{ color }} />
        <span className="flex-1 truncate font-mono text-xs text-zinc-200">
          {diff.path}
        </span>
        <span className="text-[11px] text-zinc-500">{diff.change_type}</span>
        {additions > 0 && (
          <span className="text-[11px] text-green-500">+{additions}</span>
        )}
        {deletions > 0 && (
          <span className="text-[11px] text-red-500">-{deletions}</span>
        )}
      </button>

      {/* Hunks */}
      {expanded && (
        <div className="max-h-[600px] overflow-auto bg-surface-0">
          {diff.hunks.map((hunk, i) => (
            <div key={i}>
              <div className="bg-blue-950/30 px-4 py-1 font-mono text-[11px] text-blue-400">
                {hunk.header}
              </div>
              {hunk.lines.map((line, j) => (
                <DiffLineRow key={j} line={line} />
              ))}
            </div>
          ))}
          {diff.hunks.length === 0 && (
            <div className="px-4 py-3 text-xs text-zinc-500">
              No diff content (binary file or empty change)
            </div>
          )}
        </div>
      )}
    </div>
  );
});
