import { memo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface LogMessage {
  session_id: string;
  message_type: string;
  content: string;
  timestamp: string;
}

interface Props {
  log: LogMessage;
}

// P0 Security #2: All agent output rendered as text only. No dangerouslySetInnerHTML.

const TYPE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  system: { label: "SYS", color: "text-zinc-500", bg: "bg-zinc-800/50" },
  assistant: { label: "AST", color: "text-zinc-200", bg: "bg-transparent" },
  user: { label: "RES", color: "text-emerald-400", bg: "bg-emerald-950/30" },
  result: { label: "DONE", color: "text-amber-300", bg: "bg-amber-950/20" },
  stderr: { label: "ERR", color: "text-red-400", bg: "bg-red-950/30" },
};

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function parseContent(content: string, messageType: string): ParsedContent {
  try {
    const parsed = JSON.parse(content);

    if (messageType === "assistant") {
      // assistant messages have message.content[] with text and tool_use blocks
      const blocks = parsed?.message?.content;
      if (Array.isArray(blocks)) {
        const parts: string[] = [];
        for (const b of blocks) {
          if (b.type === "text" && b.text) {
            parts.push(b.text);
          } else if (b.type === "tool_use") {
            const name = b.name || "unknown";
            const target = b.input?.file_path || b.input?.path || b.input?.command?.slice(0, 60) || "";
            parts.push(`[${name}${target ? `: ${target}` : ""}]`);
          }
        }
        const summary = parts.join(" ").slice(0, 300);
        const full = parts.join("\n\n");
        return { summary: summary || "(empty)", detail: full.length > 300 ? full : null };
      }
      return { summary: content.slice(0, 200), detail: null };
    }

    if (messageType === "user") {
      // user messages have message.content[] with tool_result blocks
      const blocks = parsed?.message?.content;
      if (Array.isArray(blocks)) {
        const parts: string[] = [];
        for (const b of blocks) {
          if (b.type === "tool_result") {
            const rc = b.content ?? "";
            const text = typeof rc === "string" ? rc : JSON.stringify(rc);
            const prefix = b.is_error ? "ERROR: " : "";
            parts.push(prefix + text.slice(0, 200));
          }
        }
        const summary = parts.join(" | ").slice(0, 300);
        const full = parts.join("\n\n");
        return { summary: summary || "(empty result)", detail: full.length > 300 ? full : null };
      }
      return { summary: content.slice(0, 200), detail: null };
    }

    if (messageType === "result") {
      // result has .result as a plain string, .subtype, etc.
      const resultText = parsed?.result;
      const subtype = parsed?.subtype;
      if (subtype === "error" || parsed?.is_error) {
        return {
          summary: `Error: ${resultText || parsed?.error || "unknown"}`,
          detail: null,
        };
      }
      return {
        summary: typeof resultText === "string" ? resultText.slice(0, 200) : "(completed)",
        detail: typeof resultText === "string" && resultText.length > 200 ? resultText : null,
      };
    }

    if (messageType === "system") {
      const subtype = parsed?.subtype;
      return {
        summary: subtype ? `[${subtype}]` : content.slice(0, 200),
        detail: null,
      };
    }

    return { summary: content.slice(0, 200), detail: null };
  } catch {
    return { summary: content.slice(0, 200), detail: content.length > 200 ? content : null };
  }
}

interface ParsedContent {
  summary: string;
  detail: string | null;
}

export const LogEntryRow = memo(function LogEntryRow({ log }: Props) {
  const [expanded, setExpanded] = useState(false);

  const style = TYPE_STYLES[log.message_type] ?? TYPE_STYLES.system;
  const { summary, detail } = parseContent(log.content, log.message_type);
  const isExpandable = detail !== null;

  return (
    <div className={`group border-b border-zinc-800/50 ${style.bg}`}>
      <div
        className={`flex items-start gap-2 px-3 py-1.5 font-mono text-xs ${isExpandable ? "cursor-pointer" : ""}`}
        onClick={isExpandable ? () => setExpanded(!expanded) : undefined}
      >
        {/* Expand toggle */}
        <span className="mt-0.5 w-3 flex-shrink-0 text-zinc-600">
          {isExpandable &&
            (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
        </span>

        {/* Timestamp */}
        <span className="flex-shrink-0 text-zinc-600">
          {formatTime(log.timestamp)}
        </span>

        {/* Type badge */}
        <span
          className={`flex-shrink-0 rounded px-1 py-0.5 text-[10px] font-bold leading-none ${style.color} bg-zinc-800/80`}
        >
          {style.label}
        </span>

        {/* Content summary */}
        <span className={`min-w-0 flex-1 break-words ${style.color}`}>
          {summary}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && detail && (
        <div className="mx-3 mb-2 ml-[72px] overflow-x-auto rounded border border-zinc-800 bg-surface-0 p-2">
          <pre className="whitespace-pre-wrap text-[11px] text-zinc-400">
            {detail}
          </pre>
        </div>
      )}
    </div>
  );
});
