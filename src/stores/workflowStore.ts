import { create } from "zustand";
import type {
  Workflow,
  WorkflowStep,
  WorkflowEdge,
  WorkflowStatus,
  StepStatus,
} from "../lib/types";
import * as tauri from "../lib/tauri";

interface WorkflowState {
  workflows: Workflow[];
  activeWorkflowId: string | null;
  steps: Map<string, WorkflowStep[]>;
  edges: Map<string, WorkflowEdge[]>;
  loading: boolean;

  // Actions
  loadWorkflows: () => Promise<void>;
  selectWorkflow: (id: string | null) => Promise<void>;
  createWorkflow: (name: string, description?: string) => Promise<Workflow>;
  deleteWorkflow: (id: string) => Promise<void>;

  // Step CRUD
  addStep: (
    workflowId: string,
    agentName: string,
    model: string,
    prompt: string,
    positionX: number,
    positionY: number,
  ) => Promise<WorkflowStep>;
  updateStep: (step: WorkflowStep) => Promise<void>;
  removeStep: (id: string, workflowId: string) => Promise<void>;

  // Edge CRUD
  addEdge: (
    workflowId: string,
    sourceStepId: string,
    targetStepId: string,
  ) => Promise<WorkflowEdge>;
  removeEdge: (id: string, workflowId: string) => Promise<void>;

  // Workflow execution
  startWorkflow: (id: string) => Promise<void>;
  stopWorkflow: (id: string) => Promise<void>;
  validateWorkflow: (id: string) => Promise<void>;

  // Event handlers
  handleWorkflowStatusChange: (workflowId: string, status: WorkflowStatus) => void;
  handleStepStatusChange: (
    workflowId: string,
    stepId: string,
    status: StepStatus,
    sessionId: string | null,
  ) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: [],
  activeWorkflowId: null,
  steps: new Map(),
  edges: new Map(),
  loading: false,

  loadWorkflows: async () => {
    set({ loading: true });
    try {
      const workflows = await tauri.listWorkflows();
      set({ workflows });
    } finally {
      set({ loading: false });
    }
  },

  selectWorkflow: async (id) => {
    set({ activeWorkflowId: id });
    if (id) {
      const [steps, edges] = await Promise.all([
        tauri.getWorkflowSteps(id),
        tauri.getWorkflowEdges(id),
      ]);
      set((state) => {
        const newSteps = new Map(state.steps);
        const newEdges = new Map(state.edges);
        newSteps.set(id, steps);
        newEdges.set(id, edges);
        return { steps: newSteps, edges: newEdges };
      });
    }
  },

  createWorkflow: async (name, description) => {
    const workflow = await tauri.createWorkflow(name, description);
    set((state) => ({ workflows: [...state.workflows, workflow] }));
    return workflow;
  },

  deleteWorkflow: async (id) => {
    await tauri.deleteWorkflow(id);
    set((state) => ({
      workflows: state.workflows.filter((w) => w.id !== id),
      activeWorkflowId:
        state.activeWorkflowId === id ? null : state.activeWorkflowId,
    }));
  },

  addStep: async (workflowId, agentName, model, prompt, positionX, positionY) => {
    const step = await tauri.addWorkflowStep(
      workflowId,
      agentName,
      model,
      prompt,
      null,
      positionX,
      positionY,
    );
    set((state) => {
      const newSteps = new Map(state.steps);
      const existing = newSteps.get(workflowId) ?? [];
      newSteps.set(workflowId, [...existing, step]);
      return { steps: newSteps };
    });
    return step;
  },

  updateStep: async (step) => {
    await tauri.updateWorkflowStep(step);
    set((state) => {
      const newSteps = new Map(state.steps);
      const existing = newSteps.get(step.workflow_id) ?? [];
      newSteps.set(
        step.workflow_id,
        existing.map((s) => (s.id === step.id ? step : s)),
      );
      return { steps: newSteps };
    });
  },

  removeStep: async (id, workflowId) => {
    await tauri.removeWorkflowStep(id);
    set((state) => {
      const newSteps = new Map(state.steps);
      const newEdges = new Map(state.edges);
      const existingSteps = newSteps.get(workflowId) ?? [];
      newSteps.set(
        workflowId,
        existingSteps.filter((s) => s.id !== id),
      );
      // Remove edges connected to this step
      const existingEdges = newEdges.get(workflowId) ?? [];
      newEdges.set(
        workflowId,
        existingEdges.filter(
          (e) => e.source_step_id !== id && e.target_step_id !== id,
        ),
      );
      return { steps: newSteps, edges: newEdges };
    });
  },

  addEdge: async (workflowId, sourceStepId, targetStepId) => {
    const edge = await tauri.addWorkflowEdge(
      workflowId,
      sourceStepId,
      targetStepId,
    );
    set((state) => {
      const newEdges = new Map(state.edges);
      const existing = newEdges.get(workflowId) ?? [];
      newEdges.set(workflowId, [...existing, edge]);
      return { edges: newEdges };
    });
    return edge;
  },

  removeEdge: async (id, workflowId) => {
    await tauri.removeWorkflowEdge(id);
    set((state) => {
      const newEdges = new Map(state.edges);
      const existing = newEdges.get(workflowId) ?? [];
      newEdges.set(
        workflowId,
        existing.filter((e) => e.id !== id),
      );
      return { edges: newEdges };
    });
  },

  startWorkflow: async (id) => {
    await tauri.startWorkflow(id);
  },

  stopWorkflow: async (id) => {
    await tauri.stopWorkflow(id);
  },

  validateWorkflow: async (id) => {
    await tauri.validateWorkflow(id);
  },

  handleWorkflowStatusChange: (workflowId, status) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === workflowId ? { ...w, status } : w,
      ),
    }));
  },

  handleStepStatusChange: (workflowId, stepId, status, sessionId) => {
    set((state) => {
      const newSteps = new Map(state.steps);
      const existing = newSteps.get(workflowId) ?? [];
      newSteps.set(
        workflowId,
        existing.map((s) =>
          s.id === stepId ? { ...s, status, session_id: sessionId } : s,
        ),
      );
      return { steps: newSteps };
    });
  },
}));
