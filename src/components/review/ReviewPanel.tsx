import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  MessageSquarePlus,
  Loader2,
  GitBranch,
} from "lucide-react";
import type { AgentSession, FileDiff, ChangedFile } from "../../lib/types";
import { getChangedFiles, getDiff } from "../../lib/tauri";
import { DiffViewer } from "./DiffViewer";
import { useSpecStore } from "../../stores/specStore";
import { useAgentStore } from "../../stores/agentStore";

interface Props {
  session: AgentSession;
}

export function ReviewPanel({ session }: Props) {
  const [changedFiles, setChangedFiles] = useState<ChangedFile[]>([]);
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisionText, setRevisionText] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);

  const specs = useSpecStore((s) => s.specs);
  const updateSpec = useSpecStore((s) => s.updateSpec);
  const resumeAgent = useAgentStore((s) => s.resumeAgent);

  const linkedSpec = specs.find(
    (s) => s.assigned_session_id === session.id,
  );

  const loadDiffs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [files, diffData] = await Promise.all([
        getChangedFiles(),
        getDiff(),
      ]);
      setChangedFiles(files);
      setDiffs(diffData);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiffs();
  }, [loadDiffs]);

  const totalAdditions = diffs.reduce(
    (sum, d) =>
      sum +
      d.hunks.reduce(
        (hs, h) => hs + h.lines.filter((l) => l.line_type === "add").length,
        0,
      ),
    0,
  );
  const totalDeletions = diffs.reduce(
    (sum, d) =>
      sum +
      d.hunks.reduce(
        (hs, h) =>
          hs + h.lines.filter((l) => l.line_type === "remove").length,
        0,
      ),
    0,
  );

  const handleApprove = async () => {
    if (linkedSpec) {
      await updateSpec(linkedSpec.file_path, { status: "done" });
    }
  };

  const handleReject = async () => {
    if (linkedSpec) {
      await updateSpec(linkedSpec.file_path, { status: "rejected" });
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionText.trim()) return;
    await resumeAgent(session.id, revisionText.trim());
    setRevisionText("");
    setShowRevisionInput(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-zinc-500" />
        <span className="ml-2 text-sm text-zinc-500">Loading diffs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={loadDiffs}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <GitBranch size={16} className="text-zinc-500" />
          <div>
            <h3 className="text-sm font-medium text-zinc-100">
              Output Review
            </h3>
            <p className="text-[11px] text-zinc-500">
              {changedFiles.length} file{changedFiles.length !== 1 ? "s" : ""}{" "}
              changed
              {totalAdditions > 0 && (
                <span className="ml-2 text-green-500">
                  +{totalAdditions}
                </span>
              )}
              {totalDeletions > 0 && (
                <span className="ml-1 text-red-500">
                  -{totalDeletions}
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={loadDiffs}
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-surface-2 hover:text-zinc-300"
          title="Refresh diffs"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Diff list */}
      <div className="flex-1 overflow-y-auto p-4">
        {diffs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <GitBranch size={32} className="text-zinc-700" />
            <p className="text-sm text-zinc-500">No diffs found</p>
            <p className="text-xs text-zinc-600">
              The working tree may be clean, or the project is not a git repo.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {diffs.map((diff) => (
              <DiffViewer key={diff.path} diff={diff} />
            ))}
          </div>
        )}
      </div>

      {/* Actions footer */}
      {(linkedSpec || session.status === "completed") && (
        <div className="flex flex-shrink-0 flex-col border-t border-zinc-800">
          {/* Revision input */}
          {showRevisionInput && (
            <div className="flex gap-2 border-b border-zinc-800 px-4 py-3">
              <input
                type="text"
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRequestRevision();
                  if (e.key === "Escape") setShowRevisionInput(false);
                }}
                placeholder="Describe what needs to change..."
                className="flex-1 rounded-lg border border-zinc-700 bg-surface-0 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-600 focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleRequestRevision}
                disabled={!revisionText.trim()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 px-4 py-3">
            <button
              onClick={() => setShowRevisionInput(!showRevisionInput)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-surface-2"
            >
              <MessageSquarePlus size={13} />
              Request Revision
            </button>

            {linkedSpec && (
              <>
                <button
                  onClick={handleReject}
                  className="flex items-center gap-1.5 rounded-lg border border-red-800/50 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-900/30"
                >
                  <XCircle size={13} />
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-500"
                >
                  <CheckCircle2 size={13} />
                  Approve
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
