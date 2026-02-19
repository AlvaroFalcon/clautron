import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQuotaStore, type QuotaUpdateEvent } from "../stores/quotaStore";

export function useQuotaEvents() {
  const handleQuotaUpdate = useQuotaStore((s) => s.handleQuotaUpdate);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<QuotaUpdateEvent>("quota:update", (event) => {
      handleQuotaUpdate(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [handleQuotaUpdate]);
}
