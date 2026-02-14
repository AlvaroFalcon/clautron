import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { WorkflowStatusEvent, StepStatusEvent } from "../lib/types";
import { useWorkflowStore } from "../stores/workflowStore";

export function useWorkflowEvents() {
  const handleWorkflowStatusChange = useWorkflowStore(
    (s) => s.handleWorkflowStatusChange,
  );
  const handleStepStatusChange = useWorkflowStore(
    (s) => s.handleStepStatusChange,
  );

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    listen<WorkflowStatusEvent>("workflow:status-changed", (event) => {
      handleWorkflowStatusChange(
        event.payload.workflow_id,
        event.payload.status,
      );
    }).then((fn) => unlisteners.push(fn));

    listen<StepStatusEvent>("workflow:step-status-changed", (event) => {
      handleStepStatusChange(
        event.payload.workflow_id,
        event.payload.step_id,
        event.payload.status,
        event.payload.session_id,
      );
    }).then((fn) => unlisteners.push(fn));

    return () => {
      for (const fn of unlisteners) fn();
    };
  }, [handleWorkflowStatusChange, handleStepStatusChange]);
}
