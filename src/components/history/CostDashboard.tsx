import { useMemo } from "react";
import { DollarSign, Cpu, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { formatTokens } from "../../lib/formatters";
import { AGENT_COLORS } from "../../lib/types";

function getAgentColor(name: string): string {
  if (name.includes("architect")) return AGENT_COLORS.red;
  if (name.includes("security")) return AGENT_COLORS.green;
  if (name.includes("orchestrator")) return AGENT_COLORS.yellow;
  return AGENT_COLORS.blue;
}

export function CostDashboard() {
  const sessions = useAgentStore((s) => s.sessions);

  const allSessions = useMemo(
    () => Array.from(sessions.values()),
    [sessions],
  );

  // Aggregate totals
  const totals = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let totalCost = 0;

    for (const s of allSessions) {
      inputTokens += s.input_tokens;
      outputTokens += s.output_tokens;
      totalCost += s.cost_usd;
    }

    return { inputTokens, outputTokens, totalCost, sessionCount: allSessions.length };
  }, [allSessions]);

  // Breakdown by agent
  const byAgent = useMemo(() => {
    const map = new Map<
      string,
      { inputTokens: number; outputTokens: number; cost: number; count: number }
    >();

    for (const s of allSessions) {
      const existing = map.get(s.agent_name) ?? {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        count: 0,
      };
      existing.inputTokens += s.input_tokens;
      existing.outputTokens += s.output_tokens;
      existing.cost += s.cost_usd;
      existing.count += 1;
      map.set(s.agent_name, existing);
    }

    return Array.from(map.entries())
      .sort((a, b) => b[1].cost - a[1].cost);
  }, [allSessions]);

  // Breakdown by model
  const byModel = useMemo(() => {
    const map = new Map<
      string,
      { inputTokens: number; outputTokens: number; cost: number; count: number }
    >();

    for (const s of allSessions) {
      const model = s.model || "unknown";
      const existing = map.get(model) ?? {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        count: 0,
      };
      existing.inputTokens += s.input_tokens;
      existing.outputTokens += s.output_tokens;
      existing.cost += s.cost_usd;
      existing.count += 1;
      map.set(model, existing);
    }

    return Array.from(map.entries())
      .sort((a, b) => b[1].cost - a[1].cost);
  }, [allSessions]);

  // Max cost for bar chart scaling
  const maxAgentCost = byAgent.length > 0 ? byAgent[0][1].cost : 1;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-12 flex-shrink-0 items-center border-b border-zinc-800 px-6">
        <h2 className="text-sm font-medium text-zinc-300">Cost Dashboard</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-4 gap-4">
          <StatCard
            label="Total Cost"
            value={`$${totals.totalCost.toFixed(2)}`}
            icon={DollarSign}
            color="#22c55e"
          />
          <StatCard
            label="Input Tokens"
            value={formatTokens(totals.inputTokens)}
            icon={ArrowUpRight}
            color="#3b82f6"
          />
          <StatCard
            label="Output Tokens"
            value={formatTokens(totals.outputTokens)}
            icon={ArrowDownRight}
            color="#f59e0b"
          />
          <StatCard
            label="Total Sessions"
            value={totals.sessionCount.toString()}
            icon={Cpu}
            color="#a855f7"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* By Agent */}
          <div className="rounded-lg border border-zinc-800 bg-surface-1 p-4">
            <h3 className="mb-4 text-sm font-medium text-zinc-200">
              Cost by Agent
            </h3>
            {byAgent.length === 0 ? (
              <p className="text-xs text-zinc-500">No data yet</p>
            ) : (
              <div className="flex flex-col gap-3">
                {byAgent.map(([name, data]) => (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: getAgentColor(name) }}
                        />
                        <span className="text-xs text-zinc-300">{name}</span>
                      </div>
                      <span className="text-xs text-zinc-400">
                        ${data.cost.toFixed(2)} ({data.count} runs)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(data.cost / maxAgentCost) * 100}%`,
                          backgroundColor: getAgentColor(name),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* By Model */}
          <div className="rounded-lg border border-zinc-800 bg-surface-1 p-4">
            <h3 className="mb-4 text-sm font-medium text-zinc-200">
              Cost by Model
            </h3>
            {byModel.length === 0 ? (
              <p className="text-xs text-zinc-500">No data yet</p>
            ) : (
              <div className="flex flex-col gap-3">
                {byModel.map(([model, data]) => {
                  const maxModelCost =
                    byModel.length > 0 ? byModel[0][1].cost : 1;
                  const modelColor =
                    model === "opus"
                      ? "#a855f7"
                      : model === "haiku"
                        ? "#22c55e"
                        : "#3b82f6";
                  return (
                    <div key={model}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium capitalize text-zinc-300">
                          {model}
                        </span>
                        <span className="text-xs text-zinc-400">
                          ${data.cost.toFixed(2)} &middot;{" "}
                          {formatTokens(data.inputTokens + data.outputTokens)}{" "}
                          tokens
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(data.cost / maxModelCost) * 100}%`,
                            backgroundColor: modelColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-[10px] text-zinc-600">
          Costs reported directly by Claude Code from session result messages.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-surface-1 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={14} style={{ color }} />
        <span className="text-[11px] text-zinc-500">{label}</span>
      </div>
      <div className="text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
