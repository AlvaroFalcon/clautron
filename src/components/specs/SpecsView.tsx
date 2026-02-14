import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { SpecListView } from "./SpecListView";
import { SpecEditor } from "./SpecEditor";

export function SpecsView() {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel defaultSize={30} minSize={20} maxSize={50}>
        <SpecListView />
      </Panel>
      <PanelResizeHandle className="w-px bg-zinc-800 transition-colors hover:bg-blue-500" />
      <Panel defaultSize={70} minSize={40}>
        <SpecEditor />
      </Panel>
    </PanelGroup>
  );
}
