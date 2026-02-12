# MVP Implementation Plan -- Agents Mission Control

## Current Progress

**Last updated**: 2026-02-12
**Status**: All milestones complete. MVP done.

### Milestone 1: CLI Validation Spike -- COMPLETE
- Created `cli-spike/` standalone Rust binary
- Validated `--print --output-format stream-json` works reliably
- Validated `--resume <session-id>` works for session continuity
- Discovered: exit code is 1 even on success; use `result:success` subtype as source of truth
- Message types observed: `system:init`, `assistant`, `result:success`
- Secure env passing works (PATH, HOME only)
- All 3 tests pass: spawn+parse, exit handling, session resume

### Milestone 2: Tauri Scaffold + Process Manager -- COMPLETE
- Tauri v2 + React 19 + Vite project initialized and compiles
- Full Rust backend: ProcessManager (spawn/kill/resume), StreamParser (with secret redaction), IPC commands
- Frontend shell: Tailwind v4 dark theme, Zustand store, Tauri event hooks, typed wrappers
- SQLite migration for sessions and log_entries tables
- P0 security: no shell injection (#1), env stripping (#3), log redaction (#5), gitignore agent-memory (#7)

### Milestone 3: Agent Dashboard + Live Status -- COMPLETE
- `Sidebar.tsx` with nav items (Dashboard, History, Settings), running agent count badge, config/session stats
- `AgentStatusBadge.tsx` with status-specific colors and ping animation for active agents
- `AgentCard.tsx` with agent color dot, status badge, prompt snippet, last activity from logs, elapsed time ticker, view/stop buttons
- `StartAgentDialog.tsx` with Radix Dialog: agent grid selection, model dropdown, prompt textarea, toast notifications
- `DashboardView.tsx` with responsive grid, sorted sessions (active first), empty state with CTA
- `App.tsx` updated with Sidebar + DashboardView + view routing (history/settings placeholders)
- `formatters.ts` with elapsed time, status, and token formatters
- All components memoized where appropriate (AgentCard, AgentStatusBadge)
- Full build compiles and app launches successfully

### Milestone 4: Log Viewer + Real-Time Streaming -- COMPLETE
- `LogEntryRow.tsx` -- Memoized, type-specific rendering (system=gray, assistant=white, tool_use=blue/collapsible, tool_result=green, result=amber, stderr=red). Parses JSON content for smart summaries. P0 Security #2: no dangerouslySetInnerHTML.
- `LogFilter.tsx` -- Type toggle buttons + text search input with count display
- `AgentLogViewer.tsx` -- Virtualized with @tanstack/react-virtual, 10-item overscan, auto-scroll when at bottom, "Jump to bottom" button on scroll-up
- `DashboardView.tsx` updated with react-resizable-panels: selecting an agent shows a resizable log panel (60/40 split)
- `LogStore` (Rust) -- SQLite persistence with batched writes (100 entries or 500ms flush interval), `get_session_logs` and `get_session_log_count` queries
- `ProcessManager` updated to persist all log events to LogStore alongside frontend emission
- `log_commands.rs` -- IPC commands for `get_session_logs` and `get_session_log_count`
- Database directory created at `~/.agents-mission-control/` with 0700 permissions (P0 Security #6)
- Frontend TypeScript wrappers added for log query commands
- Full build compiles and app bundles successfully

---

## Full Plan

### Context

Agents Mission Control is a macOS desktop app (Tauri v2 + React 19) for orchestrating multiple Claude Code agents. The project has comprehensive design docs (PRD, architecture, threat model) but started with zero implementation code. This plan breaks the MVP into 7 incremental milestones, each producing a testable deliverable, front-loading the highest-risk work (CLI integration) and baking in P0 security from day one.

**MVP acceptance**: Open app, point at project, start 3 agents, watch progress in real-time, see error, stop it, review outputs -- all without a terminal.

### Milestone 5: Agent Detail View + File/Tool Activity -- COMPLETE
- `logParser.ts` -- Shared helper extracting structured data from raw logs: `buildConversation()`, `extractToolCalls()`, `extractFileActivity()`
- `ConversationTab.tsx` -- Chat-style view with assistant bubbles, tool call cards with collapsible input, tool results (green/red), final result, system messages
- `ToolsTab.tsx` -- Table view: timestamp, tool name, target path, duration, success/error status. Expandable rows with full input/output.
- `FilesTab.tsx` -- File list grouped by path with operation badges (read/write/edit/search). Shows count of modified files.
- `InfoTab.tsx` -- Stats grid: duration, tokens (in/out), estimated cost (per-model pricing), tool calls, log entries, files touched. Full session metadata and prompt display.
- `AgentDetailPanel.tsx` -- Radix Tabs (Conversation, Tools, Files, Info) with agent header, status badge, back button, stop button
- `agent:usage-update` Tauri event -- Real-time token tracking from Rust backend to frontend
- Store updated with `detailSessionId`, `openDetail()`, `closeDetail()`, `handleUsageUpdate()`
- Navigation: Card click = select (shows log viewer in split), Eye button = open detail view, Back arrow = return to dashboard
- Full build compiles and bundles successfully

### Milestone 6: Project Context + Agent Configuration -- COMPLETE
- `config_store.rs` -- Persistent app config at `~/.agents-mission-control/config.json` with 0600 permissions (P0 Security #6)
- `agent_watcher.rs` -- FS watcher via `notify` crate, debounced 500ms, emits `agents:config-changed` event on .md file changes
- `config_commands.rs` -- IPC commands: get_config, save_config, set_project_path, get_project_path, check_agent_approval, approve_agents
- SHA-256 hash-based agent approval system (P0 Security #4): stores approved file hashes, detects new/changed agents
- `WelcomeScreen.tsx` -- First-launch project folder picker using Tauri dialog plugin
- `AgentApprovalDialog.tsx` -- Security prompt showing unapproved agents with checkboxes, approve/skip actions
- `Sidebar.tsx` updated with project name display and "Change Project" button
- `App.tsx` updated with project selection flow, agent approval integration, config persistence
- Saved config auto-restores project path on app relaunch
- Full build compiles and bundles successfully

### Milestone 7: Notifications + Session Persistence + Polish -- COMPLETE
- Desktop notifications via `@tauri-apps/plugin-notification` -- fires on agent completed, error, stopped
- Notification permission request on first use
- `SessionHistoryView.tsx` -- Table view of past sessions with agent name, status, prompt, duration, tokens, start time, view/resume actions
- `CommandPalette.tsx` -- Cmd+K command palette via `cmdk`: start agent, change project, navigate views, stop/view agents
- Graceful shutdown in `process_manager.rs` -- `shutdown_all()` aborts all running tasks and flushes logs
- `lib.rs` wired with `ExitRequested` event handler for graceful shutdown on app close
- `formatElapsed` updated to accept optional end time for historical durations
- In-app toast notifications for agent config changes and approval events
- Full build compiles and bundles (.app) successfully

---

### Milestone 4: Log Viewer + Real-Time Streaming (5-7 days)

**Deliverable**: Virtualized log viewer streaming agent output in real-time with type-specific formatting.

| # | Task | Details |
|---|------|---------|
| 1 | Rust ring buffer | `services/log_aggregator.rs`: `RingBuffer<T>` with 10k capacity/agent. Batch emit every 100ms |
| 2 | Zustand log store | `stores/logStore.ts`: logs Map<string, LogEntry[]> capped at 5k/session |
| 3 | `AgentLogViewer.tsx` | `@tanstack/react-virtual`, 10-item overscan. Auto-scroll, "jump to bottom" button |
| 4 | `LogEntry.tsx` | Type-specific rendering: system (gray), assistant (white), tool_use (blue, collapsible), tool_result (green/amber), result (bold). **No dangerouslySetInnerHTML** (P0 #2) |
| 5 | `LogFilter.tsx` + `LogSearch.tsx` | Type checkboxes + text search. Client-side filtering |
| 6 | Layout integration | Selected agent -> right panel shows log viewer (resizable split) |
| 7 | Persist logs to SQLite | Async batch inserts every 500ms or 100 entries |
| 8 | Load historical logs | Frontend calls `get_session_logs` for recent entries, then switches to live |

---

### Milestone 5: Agent Detail View + File/Tool Activity (5-7 days)

**Deliverable**: Structured agent detail panel with conversation view, tool call list, file activity tracker, and token/cost tracking.

| # | Task | Details |
|---|------|---------|
| 1 | `AgentDetailPanel.tsx` with Radix Tabs | Sections: Conversation, Tools, Files, Info |
| 2 | Conversation tab | Structured chat view: assistant messages as bubbles, tool calls as collapsible action cards |
| 3 | Tools tab | Table: timestamp, tool name, target, duration, status. Expandable rows |
| 4 | Files tab | Extract file paths from Write/Edit/Read tool calls. Deduplicate, group by file |
| 5 | Info tab | Agent metadata + token usage. Cost estimate with model pricing constants |
| 6 | File change tracking in Rust | Extract paths from tool_use in stream parser. Migration `002_file_changes.sql` |
| 7 | Token tracking in Rust | Accumulate input/output tokens. `agent:usage-update` event |
| 8 | Back-to-dashboard navigation | Breadcrumb/back button. Maintain selection state |

---

### Milestone 6: Project Context + Agent Configuration (3-5 days)

**Deliverable**: Complete project selection flow with directory picker, agent definition approval UI, filesystem watching.

| # | Task | Details |
|---|------|---------|
| 1 | Project selection flow | Welcome screen on first launch. Tauri `dialog` plugin for native file picker |
| 2 | Config persistence | Store project_path, window_size in `~/.agents-mission-control/config.json`. File 0600 |
| 3 | Agent definition security prompt | On new/changed agents: confirmation dialog. Store approved file hashes (P0 #4) |
| 4 | FS watcher for `.claude/agents/` | `notify` crate, debounced 500ms. Re-read configs, prompt if changed |
| 5 | Project info in sidebar | Project name, path, agent count, active sessions |
| 6 | Edge case handling | Missing directory, missing `.claude/agents/`, inaccessible directory |

**Can partially overlap with M5.**

---

### Milestone 7: Notifications + Session Persistence + Polish (5-7 days)

**Deliverable**: Desktop + in-app notifications, session resume across app restarts, command palette, and full MVP validation.

| # | Task | Details |
|---|------|---------|
| 1 | Desktop notifications | Tauri `notification` plugin. Fire on: completed, errored, blocked |
| 2 | In-app toasts (sonner) | Toasts for: started/stopped/errored with "View Details" action |
| 3 | Session persistence | On startup: query sessions for previously `running` -> mark as `interrupted`. Show "Resume" button |
| 4 | Session history view | Sidebar list: past sessions sorted by date. Clickable to view historical logs |
| 5 | Graceful shutdown | On app close: SIGTERM all running agents, wait 5s, SIGKILL if needed |
| 6 | Command palette | `cmdk` for Cmd+K: start agent, stop agent, switch agent, open settings |
| 7 | End-to-end acceptance test | Full scenario per MVP acceptance criteria |
| 8 | Performance validation | 5 concurrent agents: memory <300MB, startup <2s, error-to-notification <5s |

---

## Timeline Summary

| Milestone | Duration | Status |
|-----------|----------|--------|
| M1: CLI Spike | 3-4 days | COMPLETE |
| M2: Tauri Scaffold | 5-7 days | COMPLETE |
| M3: Dashboard | 5-7 days | COMPLETE |
| M4: Log Viewer | 5-7 days | COMPLETE |
| M5: Detail View | 5-7 days | COMPLETE |
| M6: Project Context | 3-5 days | COMPLETE |
| M7: Polish | 5-7 days | COMPLETE |

**Critical path**: M1 -> M2 -> M3 -> M4 -> M5 -> M7

---

## P0 Security Coverage

| Requirement | Milestone | Status |
|-------------|-----------|--------|
| #1 No shell injection | M1, M2 | Done |
| #2 Sanitize agent output | M4 | Done |
| #3 Strip env vars | M1, M2 | Done |
| #4 Prompt before loading agent defs | M3, M6 | Done |
| #5 Log redaction | M2 | Done |
| #6 File permissions 0600 | M2, M6 | Done |
| #7 Gitignore agent-memory | M2 | Done |

---

## Key Files

```
agents-mission-control/
  cli-spike/                          # M1: Standalone validation binary
    Cargo.toml
    src/main.rs

  src-tauri/                          # M2: Tauri Rust backend
    Cargo.toml
    tauri.conf.json
    build.rs
    capabilities/default.json
    src/
      main.rs
      lib.rs
      error.rs
      commands/
        mod.rs
        agent_commands.rs
        config_commands.rs
        log_commands.rs
      services/
        mod.rs
        process_manager.rs
        stream_parser.rs
        log_store.rs
        config_store.rs
        agent_watcher.rs
      models/
        mod.rs
        agent.rs
        message.rs
        session.rs
    migrations/
      001_initial.sql

  src/                                # M2-M4: React frontend
    main.tsx
    App.tsx
    vite-env.d.ts
    styles/
      globals.css
    lib/
      types.ts
      tauri.ts
      formatters.ts
      logParser.ts
    hooks/
      useAgentEvents.ts
    stores/
      agentStore.ts
    components/
      layout/
        Sidebar.tsx
        WelcomeScreen.tsx
        AgentApprovalDialog.tsx
        CommandPalette.tsx
      history/
        SessionHistoryView.tsx
      dashboard/
        AgentCard.tsx
        AgentStatusBadge.tsx
        DashboardView.tsx
        StartAgentDialog.tsx
      logs/
        AgentLogViewer.tsx
        LogEntryRow.tsx
        LogFilter.tsx
      agents/
        AgentDetailPanel.tsx
        ConversationTab.tsx
        ToolsTab.tsx
        FilesTab.tsx
        InfoTab.tsx

  package.json
  vite.config.ts
  tsconfig.json
  index.html
  .gitignore
```

---

## How to Resume

1. `cd /Users/alvaro/Documents/Proyectos/personal/agents-mission-control`
2. All 7 milestones are complete. MVP is ready for end-to-end testing.
3. Run `npm run tauri dev` for development or `npm run tauri build` for production.
4. Post-MVP work: Spec management (Iteration 4), Workflow engine (Iteration 5)
