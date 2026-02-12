import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { LogEntryRow } from "./LogEntryRow";
import { LogFilter, type LogFilterState } from "./LogFilter";
import { deduplicateStreamLogs } from "../../lib/logParser";

interface Props {
  sessionId: string;
}

const ALL_TYPES = new Set([
  "system",
  "assistant",
  "user",
  "result",
  "stderr",
]);

export function AgentLogViewer({ sessionId }: Props) {
  const logs = useAgentStore((s) => s.logs);
  const sessionLogs = logs.get(sessionId) ?? [];

  const [filter, setFilter] = useState<LogFilterState>({
    types: new Set(ALL_TYPES),
    search: "",
  });

  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Deduplicate cumulative stream-json messages, then filter
  const filteredLogs = useMemo(() => {
    const deduped = deduplicateStreamLogs(sessionLogs);
    return deduped.filter((log) => {
      if (!filter.types.has(log.message_type)) return false;
      if (
        filter.search &&
        !log.content.toLowerCase().includes(filter.search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [sessionLogs, filter]);

  const virtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  // Auto-scroll when at bottom and new logs arrive
  const prevCountRef = useRef(filteredLogs.length);
  useEffect(() => {
    if (filteredLogs.length > prevCountRef.current && isAtBottom) {
      virtualizer.scrollToIndex(filteredLogs.length - 1, { align: "end" });
    }
    prevCountRef.current = filteredLogs.length;
  }, [filteredLogs.length, isAtBottom, virtualizer]);

  // Track scroll position to detect if user is at bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 50;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = () => {
    virtualizer.scrollToIndex(filteredLogs.length - 1, { align: "end" });
    setIsAtBottom(true);
  };

  return (
    <div className="flex h-full flex-col">
      <LogFilter
        filter={filter}
        onFilterChange={setFilter}
        totalCount={sessionLogs.length}
        filteredCount={filteredLogs.length}
      />

      {filteredLogs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">
          {sessionLogs.length === 0
            ? "Waiting for agent output..."
            : "No logs match the current filter"}
        </div>
      ) : (
        <div className="relative flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="absolute inset-0 overflow-y-auto"
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <LogEntryRow log={filteredLogs[virtualRow.index]} />
                </div>
              ))}
            </div>
          </div>

          {/* Jump to bottom button */}
          {!isAtBottom && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-3 right-5 flex items-center gap-1 rounded-full border border-zinc-700 bg-surface-2 px-3 py-1.5 text-xs text-zinc-300 shadow-lg transition-colors hover:bg-surface-3"
            >
              <ArrowDown size={12} />
              Jump to bottom
            </button>
          )}
        </div>
      )}
    </div>
  );
}
