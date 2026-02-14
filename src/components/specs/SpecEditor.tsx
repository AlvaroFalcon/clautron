import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { Save, X, Plus, Play, Check, XCircle, Eye } from "lucide-react";
import { useSpecStore } from "../../stores/specStore";
import { useAgentStore } from "../../stores/agentStore";
import type { Spec, SpecPriority, SpecStatus, SpecUpdate } from "../../lib/types";
import {
  SPEC_STATUS_COLORS,
  SPEC_STATUS_LABELS,
  SPEC_PRIORITY_COLORS,
} from "../../lib/types";

export function SpecEditor() {
  const specs = useSpecStore((s) => s.specs);
  const selectedSpecPath = useSpecStore((s) => s.selectedSpecPath);
  const updateSpec = useSpecStore((s) => s.updateSpec);
  const selectSpec = useSpecStore((s) => s.selectSpec);

  const spec = useMemo(
    () => specs.find((s) => s.file_path === selectedSpecPath) ?? null,
    [specs, selectedSpecPath],
  );

  if (!spec) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        <p className="text-sm">Select a spec to edit</p>
      </div>
    );
  }

  return <SpecEditorInner key={spec.file_path} spec={spec} updateSpec={updateSpec} onClose={() => selectSpec(null)} />;
}

function SpecEditorInner({
  spec,
  updateSpec,
  onClose,
}: {
  spec: Spec;
  updateSpec: (filePath: string, update: SpecUpdate) => Promise<void>;
  onClose: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSpec = useSpecStore((s) => s.runSpec);
  const configs = useAgentStore((s) => s.configs);
  const openDetail = useAgentStore((s) => s.openDetail);

  // Local state for frontmatter fields
  const [title, setTitle] = useState(spec.title);
  const [priority, setPriority] = useState<SpecPriority>(spec.priority);
  const [status, setStatus] = useState<SpecStatus>(spec.status);
  const [criteria, setCriteria] = useState<string[]>(spec.acceptance_criteria);
  const [newCriterion, setNewCriterion] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(configs[0]?.name ?? "");
  const [selectedModel, setSelectedModel] = useState(configs[0]?.model ?? "sonnet");

  // Sync from spec prop changes (e.g., when status updates from backend)
  useEffect(() => {
    setStatus(spec.status);
  }, [spec.status]);

  useEffect(() => {
    if (spec.assigned_agent) {
      setSelectedAgent(spec.assigned_agent);
    }
  }, [spec.assigned_agent]);

  // Debounced save
  const debouncedSave = useCallback(
    (update: SpecUpdate) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateSpec(spec.file_path, update);
        setDirty(false);
      }, 1000);
    },
    [spec.file_path, updateSpec],
  );

  const saveFrontmatter = useCallback(
    (overrides?: Partial<SpecUpdate>) => {
      const update: SpecUpdate = {
        title,
        priority,
        status,
        acceptance_criteria: criteria,
        ...overrides,
      };
      setDirty(true);
      debouncedSave(update);
    },
    [title, priority, status, criteria, debouncedSave],
  );

  // CodeMirror setup
  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: spec.body,
      extensions: [
        markdown(),
        oneDark,
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const body = update.state.doc.toString();
            setDirty(true);
            debouncedSave({ body });
          }
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "13px" },
          ".cm-scroller": { overflow: "auto", fontFamily: "'SF Mono', 'Fira Code', monospace" },
          ".cm-content": { padding: "16px" },
          "&.cm-focused .cm-cursor": { borderLeftColor: "#60a5fa" },
          "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "#3b82f640" },
        }),
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [spec.file_path]);

  function addCriterion() {
    if (!newCriterion.trim()) return;
    const updated = [...criteria, newCriterion.trim()];
    setCriteria(updated);
    setNewCriterion("");
    saveFrontmatter({ acceptance_criteria: updated });
  }

  function removeCriterion(index: number) {
    const updated = criteria.filter((_, i) => i !== index);
    setCriteria(updated);
    saveFrontmatter({ acceptance_criteria: updated });
  }

  async function handleRun() {
    if (!selectedAgent) return;
    await runSpec(spec.file_path, selectedAgent, selectedModel);
    setShowRunDialog(false);
  }

  async function handleMarkDone() {
    setStatus("done");
    await updateSpec(spec.file_path, { status: "done" });
  }

  async function handleReject() {
    setStatus("rejected");
    await updateSpec(spec.file_path, { status: "rejected" });
  }

  const canRun = spec.status === "draft" || spec.status === "rejected";
  const canMarkDone = spec.status === "review";
  const canReject = spec.status === "review";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: SPEC_STATUS_COLORS[spec.status] }}
          />
          <span className="text-sm font-medium text-zinc-100">{spec.title}</span>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{ color: SPEC_STATUS_COLORS[spec.status], backgroundColor: `${SPEC_STATUS_COLORS[spec.status]}20` }}
          >
            {SPEC_STATUS_LABELS[spec.status]}
          </span>
          {dirty && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Save size={10} /> saving...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canRun && (
            <button
              onClick={() => setShowRunDialog(true)}
              className="flex items-center gap-1 rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-500"
            >
              <Play size={12} />
              Run
            </button>
          )}
          {canMarkDone && (
            <button
              onClick={handleMarkDone}
              className="flex items-center gap-1 rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-500"
            >
              <Check size={12} />
              Done
            </button>
          )}
          {canReject && (
            <button
              onClick={handleReject}
              className="flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500"
            >
              <XCircle size={12} />
              Reject
            </button>
          )}
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-surface-2 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Run dialog */}
      {showRunDialog && (
        <div className="border-b border-zinc-800 bg-surface-1 px-4 py-3">
          <div className="flex items-center gap-3">
            <select
              value={selectedAgent}
              onChange={(e) => {
                setSelectedAgent(e.target.value);
                const cfg = configs.find((c) => c.name === e.target.value);
                if (cfg) setSelectedModel(cfg.model);
              }}
              className="rounded border border-zinc-700 bg-surface-2 px-2 py-1.5 text-sm text-zinc-300"
            >
              {configs.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="rounded border border-zinc-700 bg-surface-2 px-2 py-1.5 text-sm text-zinc-300"
            >
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
            <button
              onClick={handleRun}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
            >
              Start Agent
            </button>
            <button
              onClick={() => setShowRunDialog(false)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Frontmatter sidebar */}
        <div className="w-64 flex-shrink-0 overflow-y-auto border-r border-zinc-800 p-4">
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); saveFrontmatter({ title: e.target.value }); }}
                className="w-full rounded border border-zinc-700 bg-surface-2 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</label>
              <select
                value={status}
                onChange={(e) => { const val = e.target.value as SpecStatus; setStatus(val); saveFrontmatter({ status: val }); }}
                className="w-full rounded border border-zinc-700 bg-surface-2 px-2 py-1.5 text-sm text-zinc-300 outline-none"
              >
                {Object.entries(SPEC_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Priority</label>
              <div className="flex gap-1">
                {(["p0", "p1", "p2"] as SpecPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPriority(p); saveFrontmatter({ priority: p }); }}
                    className={`flex-1 rounded px-2 py-1 text-xs font-bold transition-colors ${priority === p ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                    style={priority === p ? { backgroundColor: SPEC_PRIORITY_COLORS[p] } : { backgroundColor: "var(--color-surface-2)" }}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Acceptance Criteria */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Acceptance Criteria</label>
              <div className="space-y-1">
                {criteria.map((criterion, i) => (
                  <div key={i} className="group flex items-start gap-2 rounded bg-surface-2 px-2 py-1.5 text-xs text-zinc-300">
                    <span className="mt-0.5 flex-shrink-0 text-zinc-600">{i + 1}.</span>
                    <span className="flex-1">{criterion}</span>
                    <button onClick={() => removeCriterion(i)} className="flex-shrink-0 opacity-0 group-hover:opacity-100">
                      <X size={12} className="text-zinc-500 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-1">
                <input
                  type="text"
                  value={newCriterion}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  placeholder="Add criterion..."
                  className="flex-1 rounded border border-zinc-700 bg-surface-2 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-blue-500"
                  onKeyDown={(e) => { if (e.key === "Enter") addCriterion(); }}
                />
                <button onClick={addCriterion} className="rounded bg-surface-2 p-1 text-zinc-500 hover:text-zinc-300">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Linked session */}
            {spec.assigned_agent && (
              <div className="rounded border border-zinc-700 bg-surface-2 p-3">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Linked Agent
                </div>
                <div className="text-sm text-zinc-200">{spec.assigned_agent}</div>
                {spec.assigned_session_id && (
                  <button
                    onClick={() => openDetail(spec.assigned_session_id!)}
                    className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <Eye size={12} />
                    View Agent
                  </button>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-1 pt-2 text-[11px] text-zinc-500">
              <div>Created: {new Date(spec.created_at).toLocaleString()}</div>
              <div>Updated: {new Date(spec.updated_at).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* CodeMirror editor */}
        <div className="flex-1 overflow-hidden bg-[#282c34]" ref={editorRef} />
      </div>
    </div>
  );
}
