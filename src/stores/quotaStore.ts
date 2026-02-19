import { create } from "zustand";

export interface ModelUsageEntry {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
}

export interface DailyStats {
  date: string;
  session_count: number;
  message_count: number;
}

export interface QuotaUpdateEvent {
  models: ModelUsageEntry[];
  today: DailyStats | null;
  total_cost_usd: number;
  fetched_at: string;
  available: boolean;
  error: string | null;
}

interface QuotaState {
  /** null = not yet fetched */
  models: ModelUsageEntry[] | null;
  today: DailyStats | null;
  totalCostUsd: number;
  available: boolean | null;
  fetchedAt: string | null;
  error: string | null;

  handleQuotaUpdate: (event: QuotaUpdateEvent) => void;
}

export const useQuotaStore = create<QuotaState>((set) => ({
  models: null,
  today: null,
  totalCostUsd: 0,
  available: null,
  fetchedAt: null,
  error: null,

  handleQuotaUpdate: (event) => {
    set({
      models: event.available ? event.models : null,
      today: event.available ? event.today : null,
      totalCostUsd: event.total_cost_usd,
      available: event.available,
      fetchedAt: event.fetched_at,
      error: event.error,
    });
  },
}));
