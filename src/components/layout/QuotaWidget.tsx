import { useCallback, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { useQuotaStore } from "../../stores/quotaStore";
import { refreshQuota } from "../../lib/tauri";

/** Shorten a full Claude model ID to a readable label. */
function modelLabel(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model.split("-").slice(0, 2).join("-");
}

export function QuotaWidget() {
  const { models, today, totalCostUsd, available, fetchedAt, error } =
    useQuotaStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshQuota();
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  }, []);

  // Not yet fetched
  if (available === null) {
    return <div className="mb-2 text-[10px] text-zinc-600">Loading usage…</div>;
  }

  // Stats file unreadable
  if (!available) {
    return (
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-zinc-600">
            <WifiOff size={9} />
            <span>Usage N/A</span>
          </div>
          <button
            onClick={handleRefresh}
            title={error ?? "Usage unavailable"}
            className="text-zinc-700 hover:text-zinc-500 transition-colors"
          >
            <RefreshCw size={9} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    );
  }

  const modelsWithCost = (models ?? []).filter((m) => m.cost_usd > 0);

  return (
    <div className="mb-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Usage
        </span>
        <button
          onClick={handleRefresh}
          title={
            fetchedAt
              ? `Updated ${new Date(fetchedAt).toLocaleTimeString()}`
              : "Refresh"
          }
          className="text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <RefreshCw size={9} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Total cost */}
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] text-zinc-500">All-time cost</span>
        <span className="text-[11px] font-semibold tabular-nums text-zinc-300">
          ${totalCostUsd.toFixed(2)}
        </span>
      </div>

      {/* Today's activity */}
      {today && (
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[10px] text-zinc-500">Today</span>
          <span className="text-[10px] tabular-nums text-zinc-400">
            {today.session_count}s · {today.message_count}msg
          </span>
        </div>
      )}

      {/* Per-model cost breakdown */}
      {modelsWithCost.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          {modelsWithCost.map((m) => (
            <div key={m.model} className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-600">
                {modelLabel(m.model)}
              </span>
              <span className="text-[10px] tabular-nums text-zinc-500">
                ${m.cost_usd.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
