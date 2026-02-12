import { useState } from "react";
import { FolderOpen, Rocket } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface WelcomeScreenProps {
  onProjectSelected: (path: string) => void;
}

export function WelcomeScreen({ onProjectSelected }: WelcomeScreenProps) {
  const [loading, setLoading] = useState(false);

  async function handlePickFolder() {
    setLoading(true);
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        onProjectSelected(selected as string);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-surface-0 text-zinc-100">
      <div className="flex max-w-md flex-col items-center gap-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
          <Rocket size={32} className="text-blue-400" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Agents Mission Control
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Orchestrate, monitor, and control your Claude Code agents from a
            unified dashboard.
          </p>
        </div>

        <div className="w-full space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Get started
          </p>
          <button
            onClick={handlePickFolder}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            <FolderOpen size={16} />
            {loading ? "Opening..." : "Select Project Folder"}
          </button>
          <p className="text-xs text-zinc-500">
            Choose a directory containing a{" "}
            <code className="rounded bg-surface-2 px-1">.claude/agents/</code>{" "}
            folder with agent definitions.
          </p>
        </div>
      </div>
    </div>
  );
}
