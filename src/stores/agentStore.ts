import { create } from "zustand";
import type {
  AgentConfig,
  AgentSession,
  AgentStatusEvent,
  AgentMessageEvent,
  AgentUsageEvent,
} from "../lib/types";
import * as tauri from "../lib/tauri";

interface LogMessage {
  session_id: string;
  message_type: string;
  content: string;
  timestamp: string;
}

interface AgentState {
  // Data
  configs: AgentConfig[];
  sessions: Map<string, AgentSession>;
  selectedSessionId: string | null;
  detailSessionId: string | null;
  logs: Map<string, LogMessage[]>;

  // Actions
  loadConfigs: () => Promise<void>;
  loadSessions: () => Promise<void>;
  startAgent: (name: string, model: string, prompt: string) => Promise<string>;
  stopAgent: (sessionId: string) => Promise<void>;
  resumeAgent: (sessionId: string, prompt: string) => Promise<string>;
  selectSession: (sessionId: string | null) => void;
  openDetail: (sessionId: string) => void;
  closeDetail: () => void;

  // Event handlers
  handleStatusChange: (event: AgentStatusEvent) => void;
  handleMessage: (event: AgentMessageEvent) => void;
  handleUsageUpdate: (event: AgentUsageEvent) => void;
}

const MAX_LOGS_PER_SESSION = 5000;

export const useAgentStore = create<AgentState>((set) => ({
  configs: [],
  sessions: new Map(),
  selectedSessionId: null,
  detailSessionId: null,
  logs: new Map(),

  loadConfigs: async () => {
    const configs = await tauri.listAgents();
    set({ configs });
  },

  loadSessions: async () => {
    const sessionList = await tauri.listSessions();
    const sessions = new Map<string, AgentSession>();
    for (const s of sessionList) {
      sessions.set(s.id, s);
    }
    set({ sessions });
  },

  startAgent: async (name, model, prompt) => {
    const sessionId = await tauri.startAgent(name, model, prompt);
    // Session will be added via status-changed event
    return sessionId;
  },

  stopAgent: async (sessionId) => {
    await tauri.stopAgent(sessionId);
    // Status will be updated via status-changed event
  },

  resumeAgent: async (sessionId, prompt) => {
    const newSessionId = await tauri.resumeAgent(sessionId, prompt);
    return newSessionId;
  },

  selectSession: (sessionId) => {
    set({ selectedSessionId: sessionId });
  },

  openDetail: (sessionId) => {
    set({ detailSessionId: sessionId, selectedSessionId: sessionId });
  },

  closeDetail: () => {
    set({ detailSessionId: null });
  },

  handleStatusChange: (event) => {
    set((state) => {
      const sessions = new Map(state.sessions);
      const existing = sessions.get(event.session_id);
      if (existing) {
        sessions.set(event.session_id, {
          ...existing,
          status: event.status,
          // Update ended_at when provided (terminal states)
          ended_at: event.ended_at ?? existing.ended_at,
          // Preserve existing non-empty values, but allow updates
          model: event.model || existing.model,
          prompt: event.prompt || existing.prompt,
        });
      } else {
        // New session — use fields from the event
        sessions.set(event.session_id, {
          id: event.session_id,
          agent_name: event.agent_name,
          model: event.model,
          status: event.status,
          prompt: event.prompt,
          started_at: new Date().toISOString(),
          ended_at: event.ended_at,
          input_tokens: 0,
          output_tokens: 0,
          cost_usd: 0,
        });
      }
      return { sessions };
    });
  },

  handleMessage: (event) => {
    set((state) => {
      const logs = new Map(state.logs);
      const sessionLogs = logs.get(event.session_id) ?? [];

      // Ring buffer behavior: cap at MAX_LOGS_PER_SESSION
      const newLogs =
        sessionLogs.length >= MAX_LOGS_PER_SESSION
          ? [...sessionLogs.slice(1), event]
          : [...sessionLogs, event];

      logs.set(event.session_id, newLogs);
      return { logs };
    });
  },

  handleUsageUpdate: (event) => {
    set((state) => {
      const sessions = new Map(state.sessions);
      const existing = sessions.get(event.session_id);
      if (existing) {
        sessions.set(event.session_id, {
          ...existing,
          input_tokens: event.input_tokens,
          output_tokens: event.output_tokens,
        });
      }
      return { sessions };
    });
  },
}));
