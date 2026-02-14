import { create } from "zustand";
import type { Spec, SpecPriority, SpecUpdate } from "../lib/types";
import * as tauri from "../lib/tauri";

interface SpecState {
  specs: Spec[];
  selectedSpecPath: string | null;
  loading: boolean;

  loadSpecs: () => Promise<void>;
  createSpec: (title: string, priority: SpecPriority) => Promise<Spec>;
  updateSpec: (filePath: string, update: SpecUpdate) => Promise<void>;
  deleteSpec: (filePath: string) => Promise<void>;
  selectSpec: (filePath: string | null) => void;
  runSpec: (filePath: string, agentName: string, model: string) => Promise<string>;
}

export const useSpecStore = create<SpecState>((set, get) => ({
  specs: [],
  selectedSpecPath: null,
  loading: false,

  loadSpecs: async () => {
    set({ loading: true });
    try {
      const specs = await tauri.listSpecs();
      set({ specs });
    } finally {
      set({ loading: false });
    }
  },

  createSpec: async (title, priority) => {
    const spec = await tauri.createSpec(title, priority);
    // Reload full list to stay in sync with disk
    await get().loadSpecs();
    set({ selectedSpecPath: spec.file_path });
    return spec;
  },

  updateSpec: async (filePath, update) => {
    const updated = await tauri.updateSpec(filePath, update);
    set((state) => ({
      specs: state.specs.map((s) =>
        s.file_path === filePath ? updated : s,
      ),
    }));
  },

  deleteSpec: async (filePath) => {
    await tauri.deleteSpec(filePath);
    set((state) => ({
      specs: state.specs.filter((s) => s.file_path !== filePath),
      selectedSpecPath:
        state.selectedSpecPath === filePath ? null : state.selectedSpecPath,
    }));
  },

  selectSpec: (filePath) => {
    set({ selectedSpecPath: filePath });
  },

  runSpec: async (filePath, agentName, model) => {
    const sessionId = await tauri.runSpec(filePath, agentName, model);
    // Reload specs to get updated status/assignment
    await get().loadSpecs();
    return sessionId;
  },
}));
