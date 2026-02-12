import { useMemo } from "react";
import {
  FileEdit,
  FileOutput,
  FileSearch,
  FileText,
  FolderOpen,
} from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { extractFileActivity, type FileActivity } from "../../lib/logParser";

interface Props {
  sessionId: string;
}

const OP_ICONS: Record<string, { icon: typeof FileText; color: string }> = {
  write: { icon: FileOutput, color: "text-amber-400" },
  edit: { icon: FileEdit, color: "text-blue-400" },
  read: { icon: FileText, color: "text-zinc-400" },
  search: { icon: FileSearch, color: "text-purple-400" },
  access: { icon: FolderOpen, color: "text-zinc-500" },
};

function FileRow({ file }: { file: FileActivity }) {
  // Determine the "most significant" operation for the icon
  const hasWrite = file.operations.some((o) => o.type === "write");
  const hasEdit = file.operations.some((o) => o.type === "edit");
  const primaryOp = hasWrite ? "write" : hasEdit ? "edit" : file.operations[0]?.type ?? "read";
  const { icon: Icon, color } = OP_ICONS[primaryOp] ?? OP_ICONS.access;

  // Extract filename and directory
  const parts = file.path.split("/");
  const fileName = parts.pop() ?? file.path;
  const dir = parts.length > 0 ? parts.join("/") + "/" : "";

  return (
    <div className="flex items-center gap-3 border-b border-zinc-800/50 px-3 py-2 text-xs">
      <Icon size={14} className={`flex-shrink-0 ${color}`} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1">
          <span className="font-medium text-zinc-200">{fileName}</span>
          <span className="truncate text-[10px] text-zinc-600">{dir}</span>
        </div>
      </div>

      {/* Operation badges */}
      <div className="flex flex-shrink-0 items-center gap-1">
        {countOps(file.operations).map(([type, count]) => {
          const style = OP_ICONS[type] ?? OP_ICONS.access;
          return (
            <span
              key={type}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${style.color} bg-zinc-800`}
            >
              {count} {type}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function countOps(
  operations: FileActivity["operations"],
): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const op of operations) {
    counts.set(op.type, (counts.get(op.type) ?? 0) + 1);
  }
  // Sort: write > edit > read > search > access
  const order = ["write", "edit", "read", "search", "access"];
  return Array.from(counts.entries()).sort(
    (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]),
  );
}

export function FilesTab({ sessionId }: Props) {
  const logs = useAgentStore((s) => s.logs);
  const sessionLogs = logs.get(sessionId) ?? [];

  const files = useMemo(
    () => extractFileActivity(sessionLogs),
    [sessionLogs],
  );

  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">
        No file activity recorded
      </div>
    );
  }

  const writeCount = files.filter((f) =>
    f.operations.some((o) => o.type === "write" || o.type === "edit"),
  ).length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {files.map((file) => (
          <FileRow key={file.path} file={file} />
        ))}
      </div>

      <div className="flex-shrink-0 border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-600">
        {files.length} file{files.length !== 1 ? "s" : ""} accessed
        {" · "}
        {writeCount} modified
      </div>
    </div>
  );
}
