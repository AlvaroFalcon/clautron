import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type {
  AgentStatusEvent,
  AgentMessageEvent,
  AgentUsageEvent,
} from "../lib/types";
import { useAgentStore } from "../stores/agentStore";

const NOTIFY_STATUSES = new Set(["completed", "error", "stopped"]);

export function useAgentEvents() {
  const handleStatusChange = useAgentStore((s) => s.handleStatusChange);
  const handleMessage = useAgentStore((s) => s.handleMessage);
  const handleUsageUpdate = useAgentStore((s) => s.handleUsageUpdate);
  const handleRateLimited = useAgentStore((s) => s.handleRateLimited);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    async function setup() {
      // Request notification permission once
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
      }

      const unlisten1 = await listen<AgentStatusEvent>(
        "agent:status-changed",
        (event) => {
          handleStatusChange(event.payload);

          // Desktop notification for terminal states
          if (permissionGranted && NOTIFY_STATUSES.has(event.payload.status)) {
            const status = event.payload.status;
            const title =
              status === "completed"
                ? "Agent Completed"
                : status === "error"
                  ? "Agent Error"
                  : "Agent Stopped";

            sendNotification({
              title,
              body: `${event.payload.agent_name} has ${status}.`,
            });
          }
        },
      );
      unlisteners.push(unlisten1);

      const unlisten2 = await listen<AgentMessageEvent>(
        "agent:message",
        (event) => {
          handleMessage(event.payload);
        },
      );
      unlisteners.push(unlisten2);

      const unlisten3 = await listen<AgentUsageEvent>(
        "agent:usage-update",
        (event) => {
          handleUsageUpdate(event.payload);
        },
      );
      unlisteners.push(unlisten3);

      const unlisten4 = await listen<{
        session_id: string;
        reset_at: string | null;
        raw_message: string;
      }>("agent:rate-limited", (event) => {
        handleRateLimited(event.payload);
        if (permissionGranted) {
          const resetMsg = event.payload.reset_at
            ? ` Resets at ${new Date(event.payload.reset_at).toLocaleTimeString()}.`
            : "";
          sendNotification({
            title: "Claude Quota Exceeded",
            body: `Usage limit reached.${resetMsg}`,
          });
        }
      });
      unlisteners.push(unlisten4);
    }

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [handleStatusChange, handleMessage, handleUsageUpdate, handleRateLimited]);
}
