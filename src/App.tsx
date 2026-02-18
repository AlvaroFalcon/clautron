import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useAgentEvents } from "./hooks/useAgentEvents";
import { useSpecEvents } from "./hooks/useSpecEvents";
import { useWorkflowEvents } from "./hooks/useWorkflowEvents";
import { useAgentStore } from "./stores/agentStore";
import { useSpecStore } from "./stores/specStore";
import { useWorkflowStore } from "./stores/workflowStore";
import { Sidebar } from "./components/layout/Sidebar";
import { WelcomeScreen } from "./components/layout/WelcomeScreen";
import { LoginScreen } from "./components/layout/LoginScreen";
import { AgentApprovalDialog } from "./components/layout/AgentApprovalDialog";
import { CommandPalette } from "./components/layout/CommandPalette";
import { DashboardView } from "./components/dashboard/DashboardView";
import { SessionHistoryView } from "./components/history/SessionHistoryView";
import { CostDashboard } from "./components/history/CostDashboard";
import { AgentDetailPanel } from "./components/agents/AgentDetailPanel";
import { StartAgentDialog } from "./components/dashboard/StartAgentDialog";
import { SpecsView } from "./components/specs/SpecsView";
import { WorkflowsView } from "./components/workflow/WorkflowsView";
import { AgentTemplatesView } from "./components/agents/AgentTemplatesView";
import { Toaster, toast } from "sonner";
import * as tauri from "./lib/tauri";
import type { AgentConfigChangedEvent, UnapprovedAgent } from "./lib/types";

function App() {
  useAgentEvents();
  useSpecEvents();
  useWorkflowEvents();

  const loadConfigs = useAgentStore((s) => s.loadConfigs);
  const loadSpecs = useSpecStore((s) => s.loadSpecs);
  const loadWorkflows = useWorkflowStore((s) => s.loadWorkflows);
  const loadSessions = useAgentStore((s) => s.loadSessions);
  const detailSessionId = useAgentStore((s) => s.detailSessionId);
  const sessions = useAgentStore((s) => s.sessions);
  const closeDetail = useAgentStore((s) => s.closeDetail);
  const [activeView, setActiveView] = useState("dashboard");

  // Startup state
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [unapprovedAgents, setUnapprovedAgents] = useState<UnapprovedAgent[]>(
    [],
  );
  const [startDialogOpen, setStartDialogOpen] = useState(false);

  // Load saved project path on mount
  useEffect(() => {
    tauri
      .getProjectPath()
      .then((path) => {
        if (path) {
          setProjectPath(path);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Check Claude auth after project is set
  useEffect(() => {
    if (projectPath && !authChecked) {
      tauri.checkClaudeAuth().then((ok) => {
        setIsAuthenticated(ok);
        setAuthChecked(true);
      });
    }
  }, [projectPath, authChecked]);

  // When project is set and auth passes, load configs/sessions
  useEffect(() => {
    if (projectPath && isAuthenticated) {
      loadConfigs();
      loadSessions();
      loadSpecs();
      loadWorkflows();
      tauri.checkAgentApproval().then((agents) => {
        if (agents.length > 0) {
          setUnapprovedAgents(agents);
        }
      });
    }
  }, [projectPath, isAuthenticated, loadConfigs, loadSessions, loadSpecs, loadWorkflows]);

  // Listen for agent config file changes
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<AgentConfigChangedEvent>("agents:config-changed", () => {
      loadConfigs();
      tauri.checkAgentApproval().then((agents) => {
        if (agents.length > 0) {
          setUnapprovedAgents(agents);
          toast.warning("Agent definitions changed", {
            description: `${agents.length} agent(s) need approval.`,
          });
        }
      });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [loadConfigs]);

  const handleProjectSelected = useCallback(async (path: string) => {
    await tauri.setProjectPath(path);
    setProjectPath(path);
  }, []);

  const handleChangeProject = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      await tauri.setProjectPath(selected as string);
      setProjectPath(selected as string);
    }
  }, []);

  const handleAuthenticated = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const handleApproveAgents = useCallback(
    async (agents: UnapprovedAgent[]) => {
      const pairs: [string, string][] = agents.map((a) => [
        a.file_path,
        a.hash,
      ]);
      await tauri.approveAgents(pairs);
      setUnapprovedAgents([]);
      loadConfigs();
      toast.success(`${agents.length} agent(s) approved`);
    },
    [loadConfigs],
  );

  const handleRejectApproval = useCallback(() => {
    setUnapprovedAgents([]);
  }, []);

  const detailSession = detailSessionId
    ? sessions.get(detailSessionId) ?? null
    : null;

  // Loading spinner while checking stored config
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-0">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-400" />
      </div>
    );
  }

  // Step 1: No project configured — show welcome screen
  if (!projectPath) {
    return <WelcomeScreen onProjectSelected={handleProjectSelected} />;
  }

  // Step 2: Checking auth
  if (!authChecked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-0">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-400" />
          <p className="text-sm text-zinc-400">Checking Claude authentication...</p>
        </div>
      </div>
    );
  }

  // Step 3: Not authenticated — show login screen
  if (!isAuthenticated) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  // Step 4: Authenticated — show main app
  return (
    <div className="flex h-screen w-screen bg-surface-0 text-zinc-100">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        projectPath={projectPath}
        onChangeProject={handleChangeProject}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        {detailSession ? (
          <AgentDetailPanel session={detailSession} onBack={closeDetail} />
        ) : activeView === "dashboard" ? (
          <DashboardView />
        ) : activeView === "agents" ? (
          <AgentTemplatesView />
        ) : activeView === "specs" ? (
          <SpecsView />
        ) : activeView === "workflows" ? (
          <WorkflowsView />
        ) : activeView === "history" ? (
          <SessionHistoryView />
        ) : activeView === "costs" ? (
          <CostDashboard />
        ) : activeView === "settings" ? (
          <div className="flex flex-1 items-center justify-center text-zinc-500">
            <p className="text-sm">Settings — coming soon</p>
          </div>
        ) : null}
      </main>

      {unapprovedAgents.length > 0 && (
        <AgentApprovalDialog
          agents={unapprovedAgents}
          onApprove={handleApproveAgents}
          onReject={handleRejectApproval}
        />
      )}

      <CommandPalette
        onViewChange={setActiveView}
        onChangeProject={handleChangeProject}
        onStartAgent={() => setStartDialogOpen(true)}
      />

      <StartAgentDialog
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
      />

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#27272a",
            border: "1px solid #3f3f46",
            color: "#fafafa",
          },
        }}
      />
    </div>
  );
}

export default App;
