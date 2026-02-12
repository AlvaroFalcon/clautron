import { useState } from "react";
import { Terminal, RefreshCw, CheckCircle } from "lucide-react";
import * as tauri from "../../lib/tauri";

interface LoginScreenProps {
  onAuthenticated: () => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [checking, setChecking] = useState(false);
  const [opened, setOpened] = useState(false);

  async function handleOpenTerminal() {
    await tauri.openClaudeLogin();
    setOpened(true);
  }

  async function handleCheckAgain() {
    setChecking(true);
    try {
      const ok = await tauri.checkClaudeAuth();
      if (ok) {
        onAuthenticated();
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-surface-0 text-zinc-100">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
          <Terminal size={32} className="text-amber-400" />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Claude Code Login Required
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Claude Code CLI needs to be authenticated before agents can run.
            A Terminal window will open where you can log in.
          </p>
        </div>

        <div className="w-full space-y-3">
          {!opened ? (
            <button
              onClick={handleOpenTerminal}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              <Terminal size={16} />
              Open Terminal to Login
            </button>
          ) : (
            <>
              <div className="rounded-lg border border-zinc-700 bg-surface-1 p-4 text-left text-sm text-zinc-300">
                <p className="font-medium">In the Terminal window:</p>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-zinc-400">
                  <li>
                    Type <code className="rounded bg-surface-2 px-1">/login</code> and press Enter
                  </li>
                  <li>Follow the authentication flow in your browser</li>
                  <li>Come back here and click the button below</li>
                </ol>
              </div>

              <button
                onClick={handleCheckAgain}
                disabled={checking}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
              >
                {checking ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                {checking ? "Checking..." : "I've Logged In"}
              </button>

              <button
                onClick={handleOpenTerminal}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-400 transition-colors hover:bg-surface-2"
              >
                <Terminal size={14} />
                Open Terminal Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
