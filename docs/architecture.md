# Agents Mission Control -- Architecture Document

**Version**: 0.1.0
**Date**: 2025-02-12
**Author**: app-architect agent

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Claude Code Integration Strategy](#4-claude-code-integration-strategy)
5. [Data Flow Architecture](#5-data-flow-architecture)
6. [Component Architecture](#6-component-architecture)
7. [State Management](#7-state-management)
8. [Storage Strategy](#8-storage-strategy)
9. [Key Technical Challenges and Solutions](#9-key-technical-challenges-and-solutions)
10. [Performance Architecture](#10-performance-architecture)
11. [Security Considerations](#11-security-considerations)
12. [Project Structure](#12-project-structure)
13. [Future Extension Points](#13-future-extension-points)

---

## 1. Executive Summary

Agents Mission Control is a macOS desktop application that provides a visual
dashboard for orchestrating and monitoring Claude Code agents. It allows users
to author specifications, dispatch them to agents, observe real-time behavior
(reads, writes, tool calls), visualize agent relationships, and control agent
lifecycle (start, stop, pause, prioritize).

The application bridges the gap between Claude Code's powerful CLI-based agent
system and the need for visual oversight when running complex multi-agent
workflows.

---

## 2. Technology Stack

### 2.1 Desktop Framework: Tauri v2

**Decision**: Tauri v2 over Electron.

**Rationale**:
- **Binary size**: Tauri produces ~10 MB bundles vs Electron's ~150 MB+. For a
  single-purpose dev tool, this matters for distribution and startup time.
- **Memory**: Tauri uses the system WebView (WebKit on macOS) rather than
  bundling Chromium. On an M1 Pro with 16 GB RAM running multiple Claude Code
  agent processes, every MB saved by the shell matters.
- **Rust backend**: Tauri's Rust core gives us native process management, file
  system watchers, and stream handling with no garbage collection pauses. This
  is critical for real-time log streaming from multiple concurrent agents.
- **macOS native**: On macOS, Tauri uses WKWebView which integrates well with
  system conventions (appearance, notifications, menu bar).
- **Security**: Tauri's security model is stricter by default -- the frontend
  cannot arbitrarily access the filesystem or spawn processes without explicit
  Rust command definitions.

**Trade-off acknowledged**: Tauri's ecosystem is smaller than Electron's. Some
Electron-specific libraries (electron-store, electron-log) have no direct
equivalent. We mitigate this by implementing thin Rust wrappers for the
features we need.

**Version**: Tauri 2.x (stable, with IPC v2 and multi-window support).

### 2.2 Frontend Framework: React 19 + TypeScript

**Decision**: React with TypeScript.

**Rationale**:
- The project already uses a Claude Code agent ecosystem authored by someone
  comfortable with TypeScript. Maintaining a single language for the frontend
  minimizes cognitive overhead.
- React's component model maps well to the dashboard's modular UI (panels,
  cards, workflow diagrams, log viewers).
- The ecosystem of visualization and UI libraries (ReactFlow, Recharts,
  Radix UI) is deepest for React.
- React 19's concurrent features (useTransition, Suspense) help keep the UI
  responsive during heavy log streaming updates.

**Alternative considered**: Svelte would produce smaller bundles and has
simpler reactivity, but the visualization library ecosystem is weaker and
the team's existing TypeScript patterns align better with React.

### 2.3 Build Tooling: Vite 6

**Decision**: Vite for frontend bundling.

**Rationale**:
- First-class Tauri integration via `@tauri-apps/cli`.
- Instant HMR during development.
- Rollup-based production builds with tree-shaking.
- Native TypeScript and JSX support without configuration.

### 2.4 UI Component Library: Radix UI Primitives + Tailwind CSS v4

**Decision**: Headless primitives from Radix, styled with Tailwind.

**Rationale**:
- Radix provides accessible, unstyled components (dialogs, dropdowns, tabs,
  tooltips) that we can theme to match a dark, terminal-inspired aesthetic
  appropriate for a developer tool.
- Tailwind v4 provides utility-first styling with zero runtime overhead.
- No heavy component library dependency -- we control the design language.

**Supporting UI libraries**:
- **react-resizable-panels**: Split pane layout for the main app shell
  (sidebar, editor area, log viewer, detail panels). Replaces `allotment`
  -- more actively maintained, better API for imperative panel control,
  proven in production by Spacecake and similar apps.
- **cmdk**: Command palette (Cmd+K) for quick actions -- switch agents,
  open specs, run commands, navigate views. Low effort, high polish.
- **sonner**: Toast notification system for agent status changes, errors,
  and completions. Theme-aware, auto-dismissing, stacked. Supports the
  <5s error-to-awareness target.
- **lucide-react**: SVG icon library with a clean, consistent style that
  pairs well with Radix components. Covers all UI needs (status indicators,
  navigation, actions).

### 2.5 Workflow Visualization: ReactFlow + Mermaid

**Decision**: ReactFlow for the interactive workflow builder, Mermaid for
static diagram rendering in specs and documentation.

**Rationale for ReactFlow**:
- Purpose-built for node-based interactive diagrams.
- Handles layout, zoom, pan, selection, and edge routing out of the box.
- Supports custom node and edge renderers for agent-specific visuals.
- Active maintenance and large community.
- Performs well with dozens of nodes (our expected scale).

**Rationale for Mermaid**:
- Complements ReactFlow for non-interactive use cases: rendering flowcharts,
  sequence diagrams, and dependency graphs embedded in spec markdown.
- Agents can produce Mermaid diagrams in their output, which we render
  inline in the log viewer and spec preview.
- Lightweight -- SVG output, no interactive overhead.
- The two tools serve different purposes: ReactFlow is the interactive
  builder (Iteration 5), Mermaid is the read-only renderer (available
  from Iteration 4 in the spec editor).

### 2.6 State Management: Zustand

**Decision**: Zustand for client-side state management.

**Rationale**:
- Minimal boilerplate compared to Redux.
- Supports slices pattern for organizing state by domain (agents, logs,
  workflow, specs).
- Built-in middleware for persistence, devtools, and subscriptions.
- Works well with React's concurrent features -- no provider hierarchy needed.
- Excellent TypeScript support.

### 2.7 Package Manager: npm

Standard Node.js package manager. No reason to introduce bun or pnpm for a
greenfield project unless specifically requested.

---

## 3. System Architecture Overview

```
+------------------------------------------------------------------+
|                    Agents Mission Control                          |
|                                                                    |
|  +---------------------------+  +------------------------------+  |
|  |     Tauri Rust Backend    |  |    React Frontend (WebView)  |  |
|  |                           |  |                              |  |
|  |  +---------------------+ |  |  +------------------------+  |  |
|  |  | Process Manager     | |  |  | Dashboard View         |  |  |
|  |  | - spawn/kill agents | |  |  | - Agent cards          |  |  |
|  |  | - stream stdout/err | |  |  | - Status indicators    |  |  |
|  |  +---------------------+ |  |  | - Cost tracking        |  |  |
|  |                           |  |  +------------------------+  |  |
|  |  +---------------------+ |  |                              |  |
|  |  | Log Aggregator      | |  |  +------------------------+  |  |
|  |  | - parse stream-json | |  |  | Workflow Diagram        |  |  |
|  |  | - ring buffer       | |  |  | - ReactFlow canvas     |  |  |
|  |  | - emit to frontend  | |  |  | - Agent nodes          |  |  |
|  |  +---------------------+ |  |  | - Task edges           |  |  |
|  |                           |  |  +------------------------+  |  |
|  |  +---------------------+ |  |                              |  |
|  |  | Agent Config Reader | |  |  +------------------------+  |  |
|  |  | - .claude/agents/*  | |  |  | Spec Editor            |  |  |
|  |  | - frontmatter parse | |  |  | - Markdown authoring   |  |  |
|  |  +---------------------+ |  |  | - Template system      |  |  |
|  |                           |  |  | - Dispatch controls    |  |  |
|  |  +---------------------+ |  |  +------------------------+  |  |
|  |  | Storage Engine      | |  |                              |  |
|  |  | - SQLite (sessions) | |  |  +------------------------+  |  |
|  |  | - File (specs/logs) | |  |  | Log Viewer             |  |  |
|  |  +---------------------+ |  |  | - Virtualized list     |  |  |
|  |                           |  |  | - Filtering/search     |  |  |
|  |  +---------------------+ |  |  | - Tool call details    |  |  |
|  |  | FS Watcher          | |  |  +------------------------+  |  |
|  |  | - agent file changes| |  |                              |  |
|  |  | - project changes   | |  |  +------------------------+  |  |
|  |  +---------------------+ |  |  | Control Panel          |  |  |
|  |                           |  |  | - Start/stop/pause     |  |  |
|  +---------------------------+  |  | - Priority controls    |  |  |
|                                  |  +------------------------+  |  |
|         Tauri IPC Bridge         |                              |  |
|        (commands + events)       +------------------------------+  |
+------------------------------------------------------------------+
                |                              |
                v                              v
    +---------------------+        +---------------------+
    | Claude Code CLI     |        | File System         |
    | (child processes)   |        | .claude/agents/     |
    | --print             |        | specs/              |
    | --output-format     |        | sessions/           |
    |   stream-json       |        +---------------------+
    | --verbose           |
    +---------------------+
```

### 3.1 Layer Separation

The architecture follows a strict three-layer model:

1. **Rust Backend (Tauri Core)**: All process management, file I/O, and
   system-level operations. The frontend never directly spawns processes or
   reads files -- it requests these through Tauri commands.

2. **IPC Bridge**: Tauri's command system (request/response) and event system
   (push-based streaming). Commands are typed with TypeScript bindings
   auto-generated from Rust definitions.

3. **React Frontend**: Pure presentation and interaction logic. Receives
   structured data via events, sends commands via the Tauri invoke API.

---

## 4. Claude Code Integration Strategy

This is the most critical architectural decision. Claude Code CLI v2.1.x
provides several interfaces we can leverage.

### 4.1 Process Spawning Model

Each agent session is a child process:

```
claude --print \
       --output-format stream-json \
       --verbose \
       --agent <agent-name> \
       --session-id <uuid> \
       --model <model> \
       --permission-mode <mode> \
       --allowedTools "Bash Edit Read Write ..." \
       "<prompt>"
```

**Key flags**:
- `--print`: Non-interactive mode, required for programmatic use.
- `--output-format stream-json`: Emits newline-delimited JSON objects on
  stdout. Each object has a `type` field ("system", "assistant", "tool_use",
  "tool_result", "result") that we parse in the Rust backend.
- `--verbose`: Required when using `stream-json`. Provides detailed events
  including tool calls, not just final output.
- `--agent <name>`: Selects one of the agents defined in `.claude/agents/`.
- `--session-id <uuid>`: Allows us to assign and track session identifiers.

### 4.2 Stream-JSON Message Types

Based on empirical testing, the stream-json output produces these message types:

```
{"type": "system", "subtype": "init", ...}     -- Session initialization
{"type": "assistant", "message": {...}, ...}    -- Model responses
{"type": "tool_use", ...}                       -- Tool invocations (Bash, Edit, Read, etc.)
{"type": "tool_result", ...}                    -- Tool execution results
{"type": "result", "subtype": "success|error"}  -- Final session result
```

The Rust backend parses each line, enriches it with metadata (agent name,
timestamp, session ID), and forwards structured events to the frontend.

### 4.3 Agent Definition Reading

Agent definitions live in `.claude/agents/*.md` with YAML frontmatter:

```yaml
---
name: app-architect
description: "..."
model: opus
color: red
memory: project
---

<system prompt content>
```

The Rust backend:
1. Watches `.claude/agents/` with a filesystem watcher (notify crate).
2. Parses frontmatter on startup and on file change.
3. Exposes agent metadata to the frontend via a Tauri command.

### 4.4 Two-Way Communication

**Frontend to Agent**: The primary mechanism is spawning a new process with
a prompt. For follow-up messages within a session, we use:

```
claude --print \
       --output-format stream-json \
       --verbose \
       --resume <session-id> \
       "<follow-up prompt>"
```

The `--resume` flag continues an existing conversation with its full context.

**Agent to Frontend**: One-way via stdout stream-json parsing. The Rust backend
reads the child process stdout line-by-line and emits Tauri events.

**Input Streaming (Future)**: Claude Code supports `--input-format stream-json`
for real-time bidirectional streaming. This would allow us to send user messages
to a running session without restarting the process. This is a future
enhancement once the basic architecture is stable.

### 4.5 Session Management

```
Session Lifecycle:

  [Created] --spawn--> [Running] --stdout:result--> [Completed]
                           |
                           +--kill signal--> [Stopped]
                           |
                           +--pause logic--> [Paused]
                                  |
                                  +--resume--> [Running]
```

**Pause implementation**: Claude Code CLI does not support SIGSTOP/SIGCONT
reliably for pausing. Instead, "pause" means:
1. Record the session ID and conversation state.
2. Send SIGTERM to gracefully stop the process.
3. On "resume", respawn with `--resume <session-id>` and a continuation prompt.

This preserves the full conversation history through Claude Code's session
persistence mechanism.

### 4.6 MCP Server Possibility

Claude Code can act as an MCP server (`claude mcp serve`). A future enhancement
could run Mission Control itself as an MCP server that agents connect to,
allowing agents to report status, request approval, or coordinate through a
central hub. This inverts the control flow -- instead of Mission Control
observing agents, agents actively communicate with Mission Control.

This is documented as a Phase 2 extension point.

---

## 5. Data Flow Architecture

### 5.1 Agent Output Flow

```
Claude Code Process (stdout)
        |
        | newline-delimited JSON
        v
Rust: StreamReader (per-process tokio task)
        |
        | parse JSON, categorize message type
        v
Rust: LogAggregator
        |
        | enrich with agent metadata, timestamp
        | write to ring buffer (bounded, per-agent)
        | persist to SQLite (async batch insert)
        |
        v
Tauri Event Bus
        |
        | emit("agent:message", {agentId, message})
        | emit("agent:status", {agentId, status})
        | emit("agent:tool-call", {agentId, tool, args})
        |
        v
React Frontend (event listeners)
        |
        | update Zustand stores
        | re-render affected components
        v
Dashboard / Log Viewer / Workflow Diagram
```

### 5.2 Command Flow (User Action to Agent)

```
React UI (button click / form submit)
        |
        | invoke("start_agent", {agentName, prompt, options})
        v
Tauri Command Handler (Rust)
        |
        | validate parameters
        | resolve agent config from .claude/agents/
        | generate session UUID
        |
        v
ProcessManager::spawn()
        |
        | build CLI argument vector
        | spawn child process (tokio::process::Command)
        | register in active sessions map
        | start stdout reader task
        |
        v
Claude Code CLI Process (running)
```

### 5.3 Spec Authoring Flow

```
Spec Editor (React)
        |
        | user writes markdown spec
        | selects target agent(s)
        | configures execution options
        |
        v
invoke("save_spec", {content, metadata})
        |
        v
Rust: save to specs/ directory as .md file
        |
        v
invoke("dispatch_spec", {specId, agentName, options})
        |
        v
Rust: read spec content
      construct prompt (spec content + instructions)
      spawn agent process with constructed prompt
        |
        v
Agent execution (stream-json output flows back)
```

---

## 6. Component Architecture

### 6.1 Rust Backend Components

```
src-tauri/src/
  main.rs                    -- Tauri app setup and plugin registration
  lib.rs                     -- Public API for Tauri commands

  commands/                  -- Tauri command handlers (IPC endpoints)
    mod.rs
    agent_commands.rs        -- start, stop, pause, resume, list agents
    spec_commands.rs         -- save, load, dispatch specs
    session_commands.rs      -- query session history, logs
    config_commands.rs       -- read/write app configuration

  services/                  -- Business logic layer
    mod.rs
    process_manager.rs       -- Child process lifecycle management
    stream_parser.rs         -- Parse stream-json output from Claude CLI
    log_aggregator.rs        -- Collect, buffer, and persist log entries
    agent_config.rs          -- Read and watch .claude/agents/ definitions
    spec_manager.rs          -- Spec file CRUD operations
    session_store.rs         -- SQLite session persistence

  models/                    -- Shared data types
    mod.rs
    agent.rs                 -- AgentConfig, AgentStatus, AgentSession
    message.rs               -- StreamMessage, ToolCall, ToolResult
    spec.rs                  -- Spec, SpecExecution
    session.rs               -- Session, SessionSummary

  events.rs                  -- Tauri event type definitions
  error.rs                   -- Custom error types with thiserror
  config.rs                  -- App configuration (serde + confy)
```

**Key Rust crates**:
- `tokio` (async runtime for process management and I/O)
- `serde` / `serde_json` (JSON serialization)
- `sqlx` (async SQLite driver)
- `notify` (filesystem watcher)
- `thiserror` (error handling)
- `uuid` (session ID generation)
- `gray_matter` (YAML frontmatter parsing)

### 6.2 React Frontend Components

```
src/
  main.tsx                   -- React root, Tauri event listener setup
  App.tsx                    -- Top-level layout with sidebar navigation

  components/
    layout/
      Sidebar.tsx            -- Navigation: Dashboard, Workflow, Specs, Settings
      TopBar.tsx             -- Global status bar, notifications
      PanelLayout.tsx        -- Resizable panel container (react-resizable-panels)
      CommandPalette.tsx     -- Cmd+K quick actions (cmdk)

    dashboard/
      DashboardView.tsx      -- Main dashboard with agent grid
      AgentCard.tsx          -- Individual agent status card
      AgentStatusBadge.tsx   -- Running/stopped/error indicator
      CostSummary.tsx        -- Aggregated API cost display
      QuickActions.tsx       -- Start agent, dispatch spec shortcuts

    workflow/
      WorkflowView.tsx       -- ReactFlow canvas container
      AgentNode.tsx          -- Custom ReactFlow node for agents
      TaskEdge.tsx           -- Custom ReactFlow edge for task dependencies
      WorkflowToolbar.tsx    -- Layout controls, zoom, export
      MiniMap.tsx            -- Workflow overview minimap

    agents/
      AgentDetailPanel.tsx   -- Full agent detail view (selected agent)
      AgentLogViewer.tsx     -- Virtualized log stream for one agent
      AgentToolCallList.tsx  -- List of tool invocations with details
      AgentFileActivity.tsx  -- Files read/written by agent
      AgentControls.tsx      -- Start/stop/pause/priority controls

    specs/
      SpecEditorView.tsx     -- Main spec authoring view
      SpecEditor.tsx         -- Markdown editor (CodeMirror 6)
      SpecTemplateList.tsx   -- Predefined spec templates
      SpecDispatcher.tsx     -- Agent selection + execution config
      SpecHistory.tsx        -- Past spec executions and results

    logs/
      GlobalLogViewer.tsx    -- All-agents log stream
      LogEntry.tsx           -- Single log line with syntax highlighting
      LogFilter.tsx          -- Filter by agent, type, severity
      LogSearch.tsx          -- Full-text search across logs

    shared/
      VirtualList.tsx        -- Virtualized scrolling container (@tanstack/react-virtual)
      JsonViewer.tsx         -- Collapsible JSON tree display
      MarkdownRenderer.tsx   -- Render markdown content (with Mermaid diagram support)
      ConfirmDialog.tsx      -- Confirmation dialogs for destructive actions
      KeyboardShortcuts.tsx  -- Global keyboard shortcut handler

  stores/
    agentStore.ts            -- Agent state (configs, statuses, sessions)
    logStore.ts              -- Log entries with ring buffer behavior
    workflowStore.ts         -- Workflow diagram nodes and edges
    specStore.ts             -- Specs, templates, execution history
    uiStore.ts               -- Panel visibility, selected agent, theme

  hooks/
    useAgentEvents.ts        -- Subscribe to Tauri agent events
    useAgentProcess.ts       -- Start/stop/control agent processes
    useLogStream.ts          -- Subscribe to log events with filtering
    useWorkflowLayout.ts     -- Compute workflow layout from agent data
    useSpecDispatch.ts       -- Dispatch spec to agent(s)
    useTauriCommand.ts       -- Generic Tauri invoke wrapper with types

  lib/
    tauri.ts                 -- Typed Tauri command invocations
    types.ts                 -- Shared TypeScript types (mirrors Rust models)
    constants.ts             -- Application constants
    formatters.ts            -- Log formatting, cost formatting, time display
```

### 6.3 Component Interaction Diagram

```
+---------------------------------------------------------------+
|  App.tsx                                                       |
|  +----------------------------------------------------------+ |
|  | Sidebar | PanelLayout                                     | |
|  |         | +--------------------------------------------+  | |
|  |  [Dash] | | DashboardView                              |  | |
|  |  [Work] | |  +----------+ +----------+ +----------+    |  | |
|  |  [Spec] | |  |AgentCard | |AgentCard | |AgentCard |    |  | |
|  |  [Logs] | |  |  status  | |  status  | |  status  |    |  | |
|  |  [Sett] | |  |  cost    | |  cost    | |  cost    |    |  | |
|  |         | |  +----------+ +----------+ +----------+    |  | |
|  |         | |                                            |  | |
|  |         | |  +--------------------------------------+  |  | |
|  |         | |  | AgentDetailPanel (selected agent)    |  |  | |
|  |         | |  |  [Logs] [Tools] [Files] [Controls]  |  |  | |
|  |         | |  +--------------------------------------+  |  | |
|  |         | +--------------------------------------------+  | |
|  +----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

---

## 7. State Management

### 7.1 Zustand Store Design

State is organized into domain-specific slices that communicate through
selectors and actions, never through direct cross-store mutation.

```typescript
// stores/agentStore.ts
interface AgentState {
  // Data
  configs: Map<string, AgentConfig>;       // from .claude/agents/
  sessions: Map<string, AgentSession>;     // active + recent sessions
  selectedAgentId: string | null;

  // Actions
  loadConfigs: () => Promise<void>;
  startAgent: (name: string, prompt: string, opts?: StartOptions) => Promise<string>;
  stopAgent: (sessionId: string) => Promise<void>;
  pauseAgent: (sessionId: string) => Promise<void>;
  resumeAgent: (sessionId: string, prompt?: string) => Promise<void>;
  selectAgent: (sessionId: string | null) => void;

  // Event handlers (called from Tauri event listeners)
  handleAgentStatus: (event: AgentStatusEvent) => void;
  handleAgentMessage: (event: AgentMessageEvent) => void;
}

// stores/logStore.ts
interface LogState {
  // Ring buffer per session, max 10,000 entries each
  logs: Map<string, RingBuffer<LogEntry>>;
  filters: LogFilters;

  // Actions
  appendLog: (sessionId: string, entry: LogEntry) => void;
  setFilters: (filters: Partial<LogFilters>) => void;
  clearLogs: (sessionId: string) => void;

  // Selectors
  getFilteredLogs: (sessionId: string) => LogEntry[];
}
```

### 7.2 Why Not Redux / Context / Jotai

- **Redux**: Too much boilerplate for this application's scale. Zustand
  provides the same predictability with 80% less ceremony.
- **Context**: React Context causes re-renders of all consumers on any state
  change. With high-frequency log updates, this would be catastrophic.
- **Jotai/Recoil**: Atom-based state works well for forms and local state but
  becomes unwieldy for the interconnected domain state we need (agents reference
  sessions reference logs reference tool calls).

---

## 8. Storage Strategy

### 8.1 SQLite for Structured Data

**Engine**: SQLite via `sqlx` (Rust) for the backend.

**Schema**:

```sql
-- Agent sessions (historical record)
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,              -- UUID
    agent_name TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,             -- running, completed, stopped, error
    prompt TEXT NOT NULL,
    result TEXT,                       -- final output
    cost_usd REAL DEFAULT 0,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    metadata TEXT                      -- JSON blob for extensible data
);

-- Log entries (append-only, rotated)
CREATE TABLE log_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    type TEXT NOT NULL,               -- system, assistant, tool_use, tool_result
    content TEXT NOT NULL,            -- JSON payload
    timestamp TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Specs (authored requirements)
CREATE TABLE specs (
    id TEXT PRIMARY KEY,              -- UUID
    title TEXT NOT NULL,
    content TEXT NOT NULL,            -- Markdown content
    template_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Spec executions (linking specs to sessions)
CREATE TABLE spec_executions (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL REFERENCES specs(id),
    session_id TEXT NOT NULL REFERENCES sessions(id),
    agent_name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    FOREIGN KEY (spec_id) REFERENCES specs(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Indexes for common queries
CREATE INDEX idx_sessions_agent ON sessions(agent_name);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_log_entries_session ON log_entries(session_id);
CREATE INDEX idx_log_entries_type ON log_entries(session_id, type);
CREATE INDEX idx_spec_executions_spec ON spec_executions(spec_id);
```

**Location**: `~/.agents-mission-control/data.db`

### 8.2 File System for Large/Mutable Content

- **Specs**: Also stored as `.md` files in `~/.agents-mission-control/specs/`
  for easy editing outside the app. SQLite record points to the file.
- **Agent configs**: Read directly from `.claude/agents/` (source of truth is
  the project directory, not our database).
- **Log archives**: Old sessions' logs are exported to compressed JSON files
  in `~/.agents-mission-control/archives/` and removed from SQLite to keep
  the database small.

### 8.3 In-Memory Buffers

- **Active session logs**: Kept in a ring buffer (bounded circular buffer) in
  Rust. Default capacity: 10,000 entries per session. Older entries overflow
  to SQLite.
- **Frontend log state**: The React log store also uses a ring buffer capped
  at 5,000 entries per session to keep memory usage predictable.

---

## 9. Key Technical Challenges and Solutions

### 9.1 Challenge: Real-Time Process Monitoring Without Performance Overhead

**Problem**: Each running agent produces a continuous stream of JSON messages.
With 3-5 concurrent agents, this could generate hundreds of messages per second
during tool-heavy operations.

**Solution**: Three-tier buffering with backpressure.

```
Claude Process stdout
        |
        v
Rust: tokio::io::BufReader (OS-level buffering)
        |
        | parse line-by-line (zero-copy where possible)
        v
Rust: Ring Buffer (10k entries per agent)
        |
        | batch emit to frontend every 100ms (configurable)
        | OR immediately for status-change events
        v
React: requestAnimationFrame batched state updates
        |
        | virtualized rendering (only visible rows)
        v
DOM: ~50 visible log entries at any time
```

The 100ms batch interval means the frontend never receives more than ~10
updates per second per agent, regardless of how fast the agent produces output.
Status changes (started, stopped, error) bypass the batch and emit immediately.

### 9.2 Challenge: Rendering Complex Workflow Visualizations

**Problem**: Workflow diagrams must show agent nodes, task edges, real-time
status, and remain interactive (pan, zoom, click) during updates.

**Solution**:
- Use ReactFlow's built-in virtualization (only renders visible nodes).
- Agent status updates modify node data in-place using ReactFlow's
  `setNodes` with a functional updater, avoiding full re-renders.
- Layout computation (dagre/elk) runs in a Web Worker to avoid blocking
  the main thread during complex layouts.
- Animations use CSS transitions, not JavaScript-driven re-renders.

### 9.3 Challenge: Managing Multiple Concurrent Agent Sessions

**Problem**: Multiple Claude Code processes running simultaneously, each with
its own stdout stream, session state, and lifecycle.

**Solution**: The Rust `ProcessManager` maintains a `HashMap<SessionId, AgentProcess>`:

```rust
struct AgentProcess {
    child: tokio::process::Child,
    session_id: Uuid,
    agent_name: String,
    status: AgentStatus,
    started_at: DateTime<Utc>,
    stdout_task: JoinHandle<()>,  // tokio task reading stdout
    kill_sender: oneshot::Sender<()>,  // graceful shutdown signal
}
```

Each process gets its own tokio task for reading stdout. The task:
1. Reads lines from stdout via `BufReader::lines()`.
2. Parses each line as JSON.
3. Sends parsed messages through a channel to the LogAggregator.
4. Detects the "result" message type and updates session status.
5. On process exit, cleans up and emits a final status event.

Process isolation means one agent's crash or hang does not affect others.

### 9.4 Challenge: Handling Claude Code's CLI Interface Programmatically

**Problem**: Claude Code is designed as an interactive CLI tool. We need to
drive it programmatically while capturing structured output.

**Solution**: The `--print --output-format stream-json --verbose` combination
transforms Claude Code into a streaming JSON API. This is a first-class
interface, not a hack.

**Edge cases handled**:
- **Process crash**: Detect non-zero exit code, emit error status, log stderr.
- **Timeout**: Configurable per-agent timeout using `tokio::time::timeout`.
- **Permission prompts**: Use `--permission-mode default` or higher. In
  `--print` mode, permission prompts that would normally block cause the
  tool call to be denied, which we surface as a log entry.
- **Large outputs**: Stream processing means we never hold the full output
  in memory. Each line is processed independently.
- **Session continuity**: `--resume <session-id>` preserves conversation
  history across process restarts.

### 9.5 Challenge: Cross-Platform Considerations

**Problem**: macOS initially, but should not preclude future Linux/Windows.

**Solution**:
- Tauri is cross-platform by design. The Rust backend compiles for all three
  platforms.
- Process spawning uses `tokio::process::Command` which abstracts OS
  differences.
- File paths use `dirs` crate for platform-appropriate directories.
- The only macOS-specific code would be optional native integrations
  (Notification Center, menu bar icon) isolated behind feature flags.

---

## 10. Performance Architecture

### 10.1 Memory Budget

Target: Under 300 MB total application memory with 5 concurrent agents.

| Component              | Budget   | Strategy                          |
|------------------------|----------|-----------------------------------|
| Tauri/Rust backend     | ~30 MB   | Ring buffers, streaming I/O       |
| WebView (renderer)     | ~150 MB  | Virtualized lists, lazy loading   |
| Log buffers (5 agents) | ~50 MB   | 10k entries/agent ring buffer     |
| SQLite                 | ~20 MB   | WAL mode, periodic vacuum         |
| ReactFlow              | ~30 MB   | Node virtualization               |
| Headroom               | ~20 MB   |                                   |

### 10.2 CPU Strategy

- **Rust backend**: Async I/O via tokio. Never blocks on process reads.
  JSON parsing uses `simd-json` for performance-critical paths.
- **Frontend**: React concurrent mode with `useTransition` for non-urgent
  updates. Log rendering deferred during user interactions.
- **Layout computation**: Web Worker for dagre/elk graph layout.
- **Batch updates**: Frontend batches state mutations within animation frames.

### 10.3 Startup Performance

Target: Under 2 seconds from launch to interactive dashboard.

1. Tauri app launches (~200ms on macOS with WKWebView).
2. React app hydrates with skeleton UI (~300ms).
3. Rust backend loads agent configs from `.claude/agents/` (~50ms).
4. SQLite opens and loads recent sessions (~100ms).
5. Frontend receives initial state and renders (~500ms).
6. Background: FS watcher starts, historical logs lazy-load.

### 10.4 Log Rendering Performance

The log viewer is the most performance-critical UI component. Strategy:

- **@tanstack/react-virtual** for windowed virtualization. Hooks-first API,
  smaller bundle than react-window, supports variable row heights. Only
  renders rows visible in the viewport plus a configurable overscan buffer.
  Recommended overscan: 10 items for smooth scrolling.
- Each log entry is a memoized component (`React.memo`) with a stable key.
- Syntax highlighting for code blocks is deferred (highlight on first
  visibility, not on message arrival).
- Log text uses a monospace font with fixed row height for O(1) scroll
  position calculation.
- The same virtualization approach applies to the file tree sidebar and
  any list that could exceed a few hundred items.

---

## 11. Security Considerations

### 11.1 Process Isolation

- Agent processes run with the same user permissions as the desktop app.
  Claude Code's own permission system (`--permission-mode`) provides an
  additional control layer.
- The Tauri frontend cannot directly spawn processes. All process management
  goes through defined Rust commands.

### 11.2 No Secrets in Storage

- API keys are managed by Claude Code itself (via `claude setup-token`).
  Mission Control never stores or accesses API credentials.
- Session logs may contain file contents that agents read. The SQLite database
  should be treated as sensitive data. File permissions: 0600.

### 11.3 Input Sanitization

- Spec content is treated as untrusted input when constructing CLI arguments.
  Prompts are passed as positional arguments to `tokio::process::Command`
  (which handles escaping), never through shell interpolation.
- Markdown rendering in the frontend uses a sanitizing renderer to prevent
  XSS from agent output.

### 11.4 Tauri Security

- The Tauri `allowlist` in `tauri.conf.json` restricts which APIs the
  frontend can access. Only explicitly defined commands are available.
- No `shell:open` or arbitrary command execution from the frontend.
- CSP headers configured to prevent loading external resources.

---

## 12. Project Structure

```
agents-mission-control/
  .claude/
    agents/                          -- Agent definitions (existing)
      app-architect.md
      product-task-manager.md
      security-auditor.md
      agent-orchestrator.md
    agent-memory/                    -- Agent persistent memory

  src-tauri/                         -- Tauri Rust backend
    Cargo.toml
    tauri.conf.json
    capabilities/                    -- Tauri capability definitions
    src/
      main.rs
      lib.rs
      commands/
      services/
      models/
      events.rs
      error.rs
      config.rs
    migrations/                      -- SQLite migrations
      001_initial.sql

  src/                               -- React frontend
    main.tsx
    App.tsx
    components/
      layout/
      dashboard/
      workflow/
      agents/
      specs/
      logs/
      shared/
    stores/
    hooks/
    lib/
    styles/
      globals.css                    -- Tailwind base + custom properties

  docs/
    architecture.md                  -- This document

  specs/                             -- User-authored specs (runtime data)

  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.ts
  .gitignore
```

---

## 13. Future Extension Points

### 13.1 MCP Server Mode (Phase 2)

Run Mission Control as an MCP server that agents can connect to. This enables:
- Agents requesting human approval through the dashboard UI.
- Agents reporting structured progress (not just log text).
- Cross-agent coordination through a shared message bus.

### 13.2 Plugin Architecture (Phase 2)

A plugin system allowing third-party extensions:
- Custom agent node renderers in the workflow diagram.
- Custom log parsers for specific tool output formats.
- Integration with external services (GitHub, Linear, Slack).

Plugin interface:

```typescript
interface MissionControlPlugin {
  name: string;
  version: string;
  onAgentMessage?: (message: AgentMessage) => void;
  renderAgentNode?: (agent: AgentConfig) => React.ReactNode;
  commands?: Record<string, PluginCommand>;
}
```

### 13.3 Multi-Project Support (Phase 3)

- Open multiple project directories simultaneously.
- Each project has its own agent pool and session history.
- Global dashboard shows cross-project agent activity.

### 13.4 Collaborative Mode (Phase 3)

- Share the dashboard state over WebSocket for team visibility.
- Multiple team members can observe agent activity.
- Uses the same Tauri backend with an optional HTTP server module.

### 13.5 Agent Workflow Templates (Phase 2)

- Define reusable multi-agent workflows as YAML/JSON.
- Visual workflow editor for creating agent pipelines.
- Conditional routing based on agent output.

```yaml
# Example workflow template
name: feature-implementation
steps:
  - agent: product-task-manager
    prompt: "Break down: {{spec}}"
    output: tasks
  - agent: app-architect
    prompt: "Design architecture for: {{tasks}}"
    output: architecture
  - agent: app-architect
    prompt: "Implement: {{architecture}}"
    parallel: true
  - agent: security-auditor
    prompt: "Review implementation"
    depends_on: [2]
```

---

## Appendix A: Key Dependencies

### Rust (Cargo.toml)

| Crate        | Purpose                                |
|--------------|----------------------------------------|
| tauri 2.x    | Desktop framework                      |
| tokio        | Async runtime                          |
| serde        | Serialization                          |
| serde_json   | JSON parsing                           |
| sqlx         | Async SQLite                           |
| notify       | Filesystem watching                    |
| uuid         | Session ID generation                  |
| thiserror    | Error handling                         |
| chrono       | Timestamps                             |
| gray_matter  | YAML frontmatter parsing               |
| tracing      | Structured logging                     |

### Node.js (package.json)

| Package                  | Purpose                                    |
|--------------------------|--------------------------------------------|
| react 19.x               | UI framework                              |
| @tauri-apps/api          | Tauri frontend bindings                   |
| zustand                  | State management                          |
| @xyflow/react            | Interactive workflow diagrams (ReactFlow) |
| mermaid                  | Static diagram rendering in specs/logs    |
| @radix-ui/*              | Accessible UI primitives                  |
| tailwindcss 4.x          | Utility CSS                               |
| codemirror 6             | Spec editor with syntax highlighting      |
| @tanstack/react-virtual  | Virtualized lists (logs, file trees)      |
| react-resizable-panels   | Split pane layout                         |
| cmdk                     | Command palette (Cmd+K)                   |
| sonner                   | Toast notifications                       |
| lucide-react             | SVG icon library                          |
| vite 6.x                 | Build tool                                |
| typescript 5.x           | Type system                               |

---

## Appendix B: Tauri IPC Command Reference

These are the Tauri commands exposed from Rust to the frontend.

```typescript
// Agent management
invoke("list_agents"): Promise<AgentConfig[]>
invoke("start_agent", { name, prompt, options }): Promise<SessionId>
invoke("stop_agent", { sessionId }): Promise<void>
invoke("pause_agent", { sessionId }): Promise<void>
invoke("resume_agent", { sessionId, prompt? }): Promise<void>
invoke("get_agent_status", { sessionId }): Promise<AgentStatus>

// Session queries
invoke("list_sessions", { filters? }): Promise<SessionSummary[]>
invoke("get_session", { sessionId }): Promise<Session>
invoke("get_session_logs", { sessionId, offset, limit }): Promise<LogEntry[]>

// Spec management
invoke("list_specs"): Promise<SpecSummary[]>
invoke("get_spec", { specId }): Promise<Spec>
invoke("save_spec", { spec }): Promise<SpecId>
invoke("delete_spec", { specId }): Promise<void>
invoke("dispatch_spec", { specId, agentName, options }): Promise<SessionId>

// Configuration
invoke("get_config"): Promise<AppConfig>
invoke("set_config", { config }): Promise<void>
invoke("get_project_dir"): Promise<string>
invoke("set_project_dir", { path }): Promise<void>
```

### Tauri Events (Backend to Frontend)

```typescript
listen("agent:status-changed", (event: AgentStatusEvent) => void)
listen("agent:message", (event: AgentMessageEvent) => void)
listen("agent:tool-call", (event: AgentToolCallEvent) => void)
listen("agent:tool-result", (event: AgentToolResultEvent) => void)
listen("agent:session-ended", (event: AgentSessionEndedEvent) => void)
listen("agents:config-changed", (event: AgentConfigChangedEvent) => void)
```

---

## Appendix C: Decision Log

| # | Decision | Alternatives Considered | Rationale |
|---|----------|------------------------|-----------|
| 1 | Tauri v2 | Electron, Neutralinojs | Memory/binary size, Rust backend for process mgmt |
| 2 | React 19 | Svelte, SolidJS | Ecosystem depth, team familiarity, visualization libs |
| 3 | Zustand | Redux Toolkit, Jotai | Minimal boilerplate, good perf with frequent updates |
| 4 | SQLite | JSON files, LevelDB, PGlite | Structured queries, built-in indexing, single file. PGlite is clever but adds WASM weight for no benefit in a Tauri app with native Rust SQLite access. |
| 5 | ReactFlow | D3.js, Cytoscape.js | Purpose-built for node diagrams, React-native |
| 6 | Vite 6 | webpack, esbuild | Tauri integration, fast HMR, mature ecosystem |
| 7 | stream-json | Claude MCP server, log files | First-class CLI interface, structured output |
| 8 | Ring buffers | Unbounded arrays | Predictable memory, no GC pressure |
| 9 | Tailwind v4 | CSS Modules, styled-components | Zero runtime, utility-first, design consistency |
| 10 | CodeMirror 6 | Monaco, Lexical, ProseMirror | Lighter weight, sufficient for markdown/code editing. Lexical is overkill (designed for rich text WYSIWYG, not code). Monaco is too heavy for spec editing. |
| 11 | @tanstack/react-virtual | react-window, react-virtuoso | Hooks-first API, smaller bundle, supports variable row heights, more actively maintained |
| 12 | react-resizable-panels | allotment, react-split-pane | Better imperative API for programmatic panel control, proven in Spacecake and similar production apps |
| 13 | Mermaid + ReactFlow | ReactFlow only, D3 only | Mermaid for static diagram rendering in specs/logs (lightweight, SVG), ReactFlow for interactive workflow builder. Different tools for different use cases. |
| 14 | cmdk | kbar, custom solution | Minimal, composable, proven pattern for dev tool command palettes |
| 15 | sonner | react-hot-toast, notistack | Theme-aware, stacked, auto-dismissing. Supports <5s error-to-awareness target with minimal code. |
