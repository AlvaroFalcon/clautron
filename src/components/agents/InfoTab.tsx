import { useMemo } from "react";
import {
  Clock,
  Cpu,
  DollarSign,
  Hash,
  MessageSquare,
  Wrench,
} from "lucide-react";
import type { AgentSession } from "../../lib/types";
import { useAgentStore } from "../../stores/agentStore";
import { formatTokens } from "../../lib/formatters";
import { extractToolCalls, extractFileActivity } from "../../lib/logParser";

interface Props {
  session: AgentSession;
}

// Model pricing per million tokens (approximate, configurable later)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  opus: { input: 15, output: 75 },
  sonnet: { input: 3, output: 15 },
  haiku: { input: 0.25, output: 1.25 },
};

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING.sonnet;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-surface-1 p-3">
      <div className="mb-2 flex items-center gap-2 text-zinc-500">
        <Icon size={14} />
        <span className="text-[10px] font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-lg font-semibold text-zinc-100">{value}</div>
      {subValue && (
        <div className="mt-0.5 text-xs text-zinc-500">{subValue}</div>
      )}
    </div>
  );
}

export function InfoTab({ session }: Props) {
  const logs = useAgentStore((s) => s.logs);
  const sessionLogs = logs.get(session.id) ?? [];

  const toolCalls = useMemo(
    () => extractToolCalls(sessionLogs),
    [sessionLogs],
  );
  const files = useMemo(
    () => extractFileActivity(sessionLogs),
    [sessionLogs],
  );

  const cost = estimateCost(session.model, session.input_tokens, session.output_tokens);
  const totalTokens = session.input_tokens + session.output_tokens;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          icon={Clock}
          label="Duration"
          value={formatDuration(session.started_at, session.ended_at)}
          subValue={`Started ${new Date(session.started_at).toLocaleString()}`}
        />
        <StatCard
          icon={Hash}
          label="Tokens"
          value={formatTokens(totalTokens)}
          subValue={`${formatTokens(session.input_tokens)} in · ${formatTokens(session.output_tokens)} out`}
        />
        <StatCard
          icon={DollarSign}
          label="Estimated Cost"
          value={`$${cost.toFixed(4)}`}
          subValue={`${session.model} pricing`}
        />
        <StatCard
          icon={Wrench}
          label="Tool Calls"
          value={toolCalls.length.toString()}
          subValue={`${toolCalls.filter((c) => c.isError).length} errors`}
        />
        <StatCard
          icon={MessageSquare}
          label="Log Entries"
          value={sessionLogs.length.toString()}
        />
        <StatCard
          icon={Cpu}
          label="Files Touched"
          value={files.length.toString()}
          subValue={`${files.filter((f) => f.operations.some((o) => o.type === "write" || o.type === "edit")).length} modified`}
        />
      </div>

      {/* Session metadata */}
      <div className="rounded-lg border border-zinc-800 bg-surface-1 p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Session Details
        </h3>
        <dl className="space-y-2 text-xs">
          <Row label="Session ID" value={session.id} mono />
          <Row label="Agent" value={session.agent_name} />
          <Row label="Model" value={session.model} />
          <Row label="Status" value={session.status} />
          <Row label="Started" value={new Date(session.started_at).toLocaleString()} />
          {session.ended_at && (
            <Row label="Ended" value={new Date(session.ended_at).toLocaleString()} />
          )}
        </dl>

        {/* Prompt */}
        <h3 className="mb-2 mt-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Prompt
        </h3>
        <div className="rounded border border-zinc-800 bg-surface-0 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
          {session.prompt || "(no prompt)"}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="flex-shrink-0 text-zinc-500">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right text-zinc-300 ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
