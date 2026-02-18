import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { Save, X, Sparkles, Loader2 } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import type { AgentConfig, AgentConfigUpdate } from "../../lib/types";
import { AGENT_COLOR_OPTIONS, AGENT_COLORS } from "../../lib/types";
import { generateText } from "../../lib/tauri";

export function AgentTemplateEditor() {
  const configs = useAgentStore((s) => s.configs);
  const selectedAgentPath = useAgentStore((s) => s.selectedAgentPath);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const selectAgent = useAgentStore((s) => s.selectAgent);

  const config = useMemo(
    () => configs.find((c) => c.file_path === selectedAgentPath) ?? null,
    [configs, selectedAgentPath],
  );

  if (!config) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        <p className="text-sm">Select an agent template to edit</p>
      </div>
    );
  }

  return (
    <AgentEditorInner
      key={config.file_path}
      config={config}
      updateAgent={updateAgent}
      onClose={() => selectAgent(null)}
    />
  );
}

function getColorHex(color: string): string {
  return AGENT_COLORS[color] ?? AGENT_COLOR_OPTIONS.find((c) => c.value === color)?.hex ?? "#71717a";
}

function AgentEditorInner({
  config,
  updateAgent,
  onClose,
}: {
  config: AgentConfig;
  updateAgent: (filePath: string, update: AgentConfigUpdate) => Promise<void>;
  onClose: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState(config.name);
  const [description, setDescription] = useState(config.description);
  const [model, setModel] = useState(config.model);
  const [color, setColor] = useState(config.color);
  const [dirty, setDirty] = useState(false);

  const [showGenerate, setShowGenerate] = useState(false);
  const [genDescription, setGenDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Debounced save
  const debouncedSave = useCallback(
    (update: AgentConfigUpdate) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateAgent(config.file_path, update);
        setDirty(false);
      }, 1000);
    },
    [config.file_path, updateAgent],
  );

  const saveFields = useCallback(
    (overrides?: Partial<AgentConfigUpdate>) => {
      const update: AgentConfigUpdate = {
        name,
        description,
        model,
        color,
        ...overrides,
      };
      setDirty(true);
      debouncedSave(update);
    },
    [name, description, model, color, debouncedSave],
  );

  const handleGenerate = useCallback(async () => {
    const desc = genDescription.trim();
    if (!desc || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const metaPrompt =
        `Generate a system prompt body for a Claude Code agent.\n\n` +
        `Agent purpose: ${desc}\n\n` +
        `Rules:\n` +
        `- Output ONLY the system prompt body in markdown\n` +
        `- No YAML frontmatter, no preamble, no "Here is..." intro\n` +
        `- Define the agent's role, approach, capabilities, and key instructions\n` +
        `- Use markdown headers and bullet lists where helpful\n` +
        `- Be specific and actionable, 200-500 words`;
      const result = await generateText(metaPrompt);
      // Insert result into the CodeMirror editor
      const view = viewRef.current;
      if (view) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: result },
        });
      }
      setShowGenerate(false);
      setGenDescription("");
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [genDescription, generating]);

  // CodeMirror setup
  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: config.body,
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
          ".cm-scroller": {
            overflow: "auto",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
          },
          ".cm-content": { padding: "16px" },
          "&.cm-focused .cm-cursor": { borderLeftColor: "#60a5fa" },
          "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
            backgroundColor: "#3b82f640",
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [config.file_path]);

  // Extract filename from path
  const fileName = config.file_path.split("/").pop() ?? "";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: getColorHex(color) }}
          />
          <span className="text-sm font-medium text-zinc-100">{name}</span>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {model}
          </span>
          {dirty && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Save size={10} /> saving...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowGenerate((v) => {
                if (!v) setGenDescription(description); // seed from sidebar field
                return !v;
              });
              setGenError(null);
            }}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              showGenerate
                ? "bg-violet-600 text-white"
                : "border border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-violet-300"
            }`}
          >
            <Sparkles size={12} />
            Generate
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-surface-2 hover:text-zinc-300"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* AI Generate panel */}
      {showGenerate && (
        <div className="flex-shrink-0 border-b border-zinc-800 bg-violet-950/20 px-4 py-3">
          <p className="mb-2 text-[11px] text-violet-300/70">
            Refine the description if needed — Claude will write the system prompt body.
          </p>
          <div className="flex gap-2">
            <textarea
              value={genDescription}
              onChange={(e) => setGenDescription(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              placeholder="e.g. An agent that reviews pull requests for security vulnerabilities..."
              rows={2}
              disabled={generating}
              className="flex-1 resize-none rounded border border-zinc-700 bg-surface-0 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500 disabled:opacity-50"
              autoFocus
            />
            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleGenerate}
                disabled={!genDescription.trim() || generating}
                className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
              >
                {generating ? (
                  <><Loader2 size={11} className="animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles size={11} /> Generate</>
                )}
              </button>
              <button
                onClick={() => { setShowGenerate(false); setGenError(null); }}
                disabled={generating}
                className="rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
          {genError && (
            <p className="mt-2 text-[11px] text-red-400">{genError}</p>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Metadata sidebar */}
        <div className="w-60 flex-shrink-0 overflow-y-auto border-r border-zinc-800 p-4">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  saveFields({ name: e.target.value });
                }}
                className="w-full rounded border border-zinc-700 bg-surface-2 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  saveFields({ description: e.target.value });
                }}
                rows={3}
                className="w-full rounded border border-zinc-700 bg-surface-2 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Model */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  saveFields({ model: e.target.value });
                }}
                className="w-full rounded border border-zinc-700 bg-surface-2 px-2 py-1.5 text-sm text-zinc-300 outline-none"
              >
                <option value="opus">Opus</option>
                <option value="sonnet">Sonnet</option>
                <option value="haiku">Haiku</option>
              </select>
            </div>

            {/* Color */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {AGENT_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => {
                      setColor(c.value);
                      saveFields({ color: c.value });
                    }}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${
                      color === c.value
                        ? "border-white scale-110"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* File path */}
            <div className="space-y-1 pt-2 text-[11px] text-zinc-500">
              <div className="font-medium uppercase tracking-wider">File</div>
              <div className="break-all">{fileName}</div>
            </div>
          </div>
        </div>

        {/* CodeMirror editor for system prompt body */}
        <div className="flex-1 overflow-hidden bg-[#282c34]" ref={editorRef} />
      </div>
    </div>
  );
}
