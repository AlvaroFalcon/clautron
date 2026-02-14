import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { SpecsChangedEvent, SpecStatusChangedEvent } from "../lib/types";
import { useSpecStore } from "../stores/specStore";

export function useSpecEvents() {
  const loadSpecs = useSpecStore((s) => s.loadSpecs);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    listen<SpecsChangedEvent>("specs:changed", () => {
      loadSpecs();
    }).then((fn) => unlisteners.push(fn));

    listen<SpecStatusChangedEvent>("spec:status-changed", () => {
      loadSpecs();
    }).then((fn) => unlisteners.push(fn));

    return () => unlisteners.forEach((fn) => fn());
  }, [loadSpecs]);
}
