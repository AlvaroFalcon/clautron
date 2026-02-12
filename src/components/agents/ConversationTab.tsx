import { memo, useMemo, useRef, useEffect } from "react";
import {
  Bot,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { buildConversation, type ConversationItem } from "../../lib/logParser";

interface Props {
  sessionId: string;
}

// P0 Security #2: All agent output rendered as text only.

const ConversationBubble = memo(function ConversationBubble({
  item,
}: {
  item: ConversationItem;
}) {
  const time = formatTime(item.timestamp);

  if (item.type === "assistant") {
    return (
      <div className="flex gap-2">
        <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-900/40">
          <Bot size={12} className="text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 text-[10px] text-zinc-600">{time}</div>
          <div className="rounded-lg rounded-tl-none bg-surface-2 px-3 py-2 text-sm text-zinc-200 whitespace-pre-wrap">
            {item.text}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === "tool_call") {
    return (
      <div className="flex gap-2">
        <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-900/40">
          <Wrench size={12} className="text-indigo-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 text-[10px] text-zinc-600">{time}</div>
          <div className="rounded-lg border border-zinc-800 bg-surface-1 px-3 py-2">
            <span className="text-xs font-medium text-indigo-400">
              {item.toolName}
            </span>
            {item.toolInput && (
              <pre className="mt-1 max-h-32 overflow-auto text-[11px] text-zinc-500">
                {item.toolInput}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === "tool_result") {
    return (
      <div className="ml-8 rounded-lg border border-zinc-800/50 bg-surface-0 px-3 py-2">
        <div className="flex items-center gap-1 text-[10px] text-zinc-600">
          {item.isError ? (
            <AlertTriangle size={10} className="text-red-400" />
          ) : (
            <CheckCircle2 size={10} className="text-emerald-500" />
          )}
          <span>{time}</span>
        </div>
        <pre
          className={`mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] ${
            item.isError ? "text-red-400" : "text-zinc-400"
          }`}
        >
          {item.text}
        </pre>
      </div>
    );
  }

  if (item.type === "result") {
    return (
      <div className="flex gap-2">
        <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-900/40">
          <CheckCircle2 size={12} className="text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 text-[10px] text-zinc-600">{time}</div>
          <div className="rounded-lg bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300 whitespace-pre-wrap">
            {item.text}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === "error") {
    return (
      <div className="flex gap-2">
        <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-900/40">
          <AlertTriangle size={12} className="text-red-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 text-[10px] text-zinc-600">{time}</div>
          <div className="rounded-lg bg-red-950/30 px-3 py-2 text-sm text-red-300 whitespace-pre-wrap">
            {item.text}
          </div>
        </div>
      </div>
    );
  }

  // system
  return (
    <div className="flex items-center gap-2 py-1 text-[11px] text-zinc-600">
      <Info size={10} />
      <span>{time}</span>
      <span>{item.text}</span>
    </div>
  );
});

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ConversationTab({ sessionId }: Props) {
  const logs = useAgentStore((s) => s.logs);
  const sessionLogs = logs.get(sessionId) ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => buildConversation(sessionLogs), [sessionLogs]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">
        Waiting for conversation...
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
      {items.map((item, i) => (
        <ConversationBubble key={i} item={item} />
      ))}
    </div>
  );
}
