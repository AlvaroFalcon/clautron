import { useState, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ArrowLeft } from "lucide-react";
import { WorkflowListView } from "./WorkflowListView";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { WorkflowSidebar } from "./WorkflowSidebar";
import { useWorkflowStore } from "../../stores/workflowStore";

export function WorkflowsView() {
  const activeWorkflowId = useWorkflowStore((s) => s.activeWorkflowId);
  const selectWorkflow = useWorkflowStore((s) => s.selectWorkflow);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const handleSelectWorkflow = useCallback(
    (id: string) => {
      selectWorkflow(id);
      setSelectedStepId(null);
    },
    [selectWorkflow],
  );

  const handleBack = useCallback(() => {
    selectWorkflow(null);
    setSelectedStepId(null);
  }, [selectWorkflow]);

  // Show list when no workflow is selected
  if (!activeWorkflowId) {
    return <WorkflowListView onSelect={handleSelectWorkflow} />;
  }

  // Show canvas + sidebar when editing a workflow
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Back button header */}
      <div className="flex h-10 flex-shrink-0 items-center border-b border-zinc-800 px-3">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-surface-2 hover:text-zinc-200"
        >
          <ArrowLeft size={14} />
          Back to workflows
        </button>
      </div>

      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={75} minSize={50}>
          <WorkflowCanvas
            workflowId={activeWorkflowId}
            onNodeSelect={setSelectedStepId}
          />
        </Panel>
        <PanelResizeHandle className="w-px bg-zinc-800 transition-colors hover:bg-zinc-600" />
        <Panel defaultSize={25} minSize={20}>
          <WorkflowSidebar
            workflowId={activeWorkflowId}
            selectedStepId={selectedStepId}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
