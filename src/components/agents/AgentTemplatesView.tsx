import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { AgentTemplateList } from "./AgentTemplateList";
import { AgentTemplateEditor } from "./AgentTemplateEditor";
import { AgentRelationshipDiagram } from "./AgentRelationshipDiagram";

type Tab = "templates" | "relationships";

export function AgentTemplatesView() {
  const [activeTab, setActiveTab] = useState<Tab>("templates");

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800">
        <TabButton
          label="Templates"
          isActive={activeTab === "templates"}
          onClick={() => setActiveTab("templates")}
        />
        <TabButton
          label="Relationships"
          isActive={activeTab === "relationships"}
          onClick={() => setActiveTab("relationships")}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "templates" ? (
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={30} minSize={20} maxSize={50}>
              <AgentTemplateList />
            </Panel>
            <PanelResizeHandle className="w-px bg-zinc-800 transition-colors hover:bg-blue-500" />
            <Panel defaultSize={70} minSize={40}>
              <AgentTemplateEditor />
            </Panel>
          </PanelGroup>
        ) : (
          <AgentRelationshipDiagram />
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "border-b-2 border-blue-500 text-zinc-100"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}
