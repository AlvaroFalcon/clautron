# CLAUDE.md -- Agents Mission Control

## Project Overview

Agents Mission Control is a macOS desktop application for orchestrating, monitoring, and controlling Claude Code agents. It replaces the workflow of juggling multiple terminal windows with a unified visual command center.

**Value proposition**: "Stop babysitting terminals. Start commanding agents."

The core insight: as AI agents become more capable, the bottleneck shifts from writing code to orchestrating, monitoring, and reviewing agent work. This app is purpose-built for that workflow -- define what to build (specs), assign agents, monitor progress, intervene when needed, and review outputs.

**Key documents**:
- Product requirements: `docs/PRD.md`
- Architecture: `docs/architecture.md`
- Threat model: `.claude/agent-memory/security-auditor/threat-model.md`

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop framework | **Tauri v2** | ~10MB binary, Rust backend for process mgmt, lower memory than Electron |
| Frontend | **React 19 + TypeScript** | Component model fits dashboard UI; deepest visualization ecosystem |
| Build | **Vite 6** | First-class Tauri integration, instant HMR |
| State management | **Zustand** | Minimal boilerplate, handles high-frequency updates without re-render storms |
| UI components | **Radix UI + Tailwind CSS v4** | Accessible headless primitives, zero-runtime styling |
| Panel layout | **react-resizable-panels** | Battle-tested split panes for sidebar/dashboard/detail/log layout |
| Workflow viz | **ReactFlow (@xyflow/react)** | Purpose-built node diagrams with zoom/pan/selection |
| Diagram rendering | **Mermaid** | Static diagram preview for specs and agent workflow documentation |
| Spec editor | **CodeMirror 6** | Lightweight markdown editing with syntax highlighting |
| Database | **SQLite via sqlx** (Rust) | Embedded, structured queries, single file |
| Virtualized lists | **@tanstack/react-virtual** | Hooks-first virtualization for log streams, file trees, large lists |
| Command palette | **cmdk** | Cmd+K quick actions -- switch agents, open specs, run commands |
| Notifications | **sonner** | Themed toast notifications for agent status, errors, completions |
| Icons | **lucide-react** | Clean, consistent SVG icon set matching Radix component style |
| Package manager | **npm** | Standard Node.js tooling |

---

## Architecture

### Three-Layer Model (Strict Separation)

1. **Rust Backend** (`src-tauri/`): All process management, file I/O, SQLite, filesystem watchers. The frontend never directly spawns processes or reads files.
2. **IPC Bridge**: Tauri commands (request/response) + Tauri events (push-based streaming). TypeScript bindings auto-generated from Rust definitions.
3. **React Frontend** (`src/`): Pure presentation and interaction. Receives data via events, sends commands via `invoke()`.

### Claude Code Integration

Each agent session is a child process using these flags:
```
claude --print --output-format stream-json --verbose --agent <name> --session-id <uuid> "<prompt>"
```

- `--print`: Non-interactive mode for programmatic use
- `--output-format stream-json`: Newline-delimited JSON on stdout (types: `system`, `assistant`, `tool_use`, `tool_result`, `result`)
- `--resume <session-id>`: Continue existing sessions across process restarts

### Data Flow (Three-Tier Buffering)

```
Claude Process stdout -> Rust BufReader (parse JSON per line)
  -> Rust Ring Buffer (10k entries/agent, batch emit every 100ms)
  -> React Frontend (requestAnimationFrame batched updates, virtualized rendering)
```

Status-change events bypass the batch and emit immediately.

### Performance Targets

- Memory: <300MB with 5 concurrent agents
- Startup: <2 seconds to interactive dashboard
- Error-to-awareness: <5 seconds (core value prop)

---

## Development Phases

### Iteration 0: Technical Validation (1-2 weeks)
- **CRITICAL**: Validate Claude Code CLI programmatic control (`--print --output-format stream-json`)
- Prototype: start agent, read structured output, stop agent
- Confirm session resume works via `--resume`
- **Gate**: Do not invest in UI until process management is proven

### Iteration 1: Scaffold + Agent Process Manager (1-2 weeks)
- Tauri app scaffold with React + Vite
- Rust `ProcessManager` (spawn/kill/stream)
- SQLite schema and migrations
- Basic dashboard shell

### Iteration 2: Live Dashboard (1-2 weeks)
- Real-time agent status cards
- Log viewer with streaming
- Agent start/stop from UI
- Desktop notifications

### Iteration 3: Agent Detail + Session Management (1-2 weeks)
- Conversation history, files touched, commands run
- Session persistence across app restarts
- Project context (auto-detect `.claude/agents/`)
- Token usage tracking

### Iteration 4: Spec Management (2-3 weeks)
- Markdown spec editor with frontmatter
- Spec lifecycle (draft -> assigned -> in-progress -> review -> done)
- Spec-to-agent binding
- Output review panel with diffs

### Iteration 5: Workflow Engine (2-3 weeks)
- DAG-based workflow definitions
- Visual workflow builder (ReactFlow)
- Workflow execution engine
- Agent relationship diagram

---

## Key Decisions

1. **Tauri over Electron**: Smaller binary, Rust backend ideal for process management, stricter security model. Trade-off: smaller ecosystem.
2. **Zustand over Redux/Context**: High-frequency log updates would cause re-render storms with Context; Redux is too much boilerplate for this scale.
3. **SQLite over JSON files**: Structured queries, indexing, single file. Stored at `~/.agents-mission-control/data.db`.
4. **Ring buffers for logs**: Predictable memory usage. 10k entries per agent in Rust, 5k in React frontend.
5. **Pause = stop + resume**: Claude Code CLI does not support SIGSTOP/SIGCONT. "Pause" means SIGTERM then `--resume <session-id>` with continuation prompt.
6. **Desktop app over VS Code extension**: Agent orchestration is a parallel activity to coding; needs persistent screen real estate; editor-agnostic.
7. **macOS first, cross-platform later**: Tauri is cross-platform by design. macOS-specific code (Notification Center, menu bar) isolated behind feature flags.

---

## Security Requirements

These are non-negotiable for any code written in this project. See the full threat model in `.claude/agent-memory/security-auditor/threat-model.md`.

### P0 -- Must be in every PR

1. **No shell injection**: Always use `spawn()` with argument arrays. Never `exec()` with interpolated strings. Set `shell: false`.
   ```rust
   // CORRECT
   Command::new("claude").args(["--print", "--output-format", "stream-json", &prompt])
   // WRONG
   Command::new("sh").arg("-c").arg(format!("claude --print {}", prompt))
   ```

2. **Sanitize all agent output**: Agent output is untrusted. Render as text only -- never interpret HTML, never use `dangerouslySetInnerHTML`, never execute JavaScript from agent output.

3. **Strip environment variables**: When spawning agent processes, pass only a minimal allowlist of env vars (PATH, HOME, CLAUDE_API_KEY equivalent). Never pass the full `process.env`.

4. **Prompt before loading agent definitions**: When opening a project, show the user what agents will be loaded from `.claude/agents/`. Never auto-execute agent definitions from cloned repos.

5. **Log redaction**: Scan for and redact patterns matching API keys, tokens, and credentials before persisting logs to SQLite.

6. **File permissions**: SQLite database and log files must have 0600 permissions. Agent memory files likewise.

7. **Gitignore agent memory**: `.claude/agent-memory/` must be in `.gitignore`. It may contain sensitive context.

### P1 -- Required for v1.0

8. Per-agent filesystem sandboxing (restrict working directories)
9. Process resource limits per agent (CPU, memory, timeout)
10. Strict Content Security Policy in Tauri config
11. Signed auto-updates
12. MCP server allowlisting

---

## Conventions

### Project Structure

```
agents-mission-control/
  src-tauri/                    # Rust backend
    src/
      main.rs                   # Tauri app setup
      lib.rs                    # Public API
      commands/                 # IPC command handlers
      services/                 # Business logic
      models/                   # Data types
      events.rs                 # Event definitions
      error.rs                  # Error types (thiserror)
    migrations/                 # SQLite migrations
    Cargo.toml
    tauri.conf.json

  src/                          # React frontend
    main.tsx
    App.tsx
    components/
      layout/                   # Sidebar, TopBar, PanelLayout, CommandPalette
      dashboard/                # AgentCard, DashboardView
      workflow/                 # ReactFlow canvas, AgentNode
      agents/                   # AgentDetailPanel, LogViewer
      specs/                    # SpecEditor, SpecDispatcher
      logs/                     # GlobalLogViewer, LogFilter
      shared/                   # VirtualList, JsonViewer, ConfirmDialog
    stores/                     # Zustand stores (agentStore, logStore, etc.)
    hooks/                      # Custom hooks (useAgentEvents, useTauriCommand)
    lib/                        # Typed Tauri commands, constants, formatters

  docs/                         # Architecture docs, PRD
  specs/                        # User-authored specs (runtime data)
  .claude/agents/               # Agent definitions
```

### Code Style

- **TypeScript**: Strict mode. No `any` types. Prefer interfaces over type aliases for object shapes. Use barrel exports (`index.ts`) per directory.
- **Rust**: Follow standard `rustfmt` conventions. Use `thiserror` for error types. All public functions documented with `///` doc comments.
- **React components**: Functional components only. Use `React.memo` for performance-critical components (log entries). Co-locate component, styles, and tests.
- **State**: Domain-specific Zustand slices. Cross-store communication through selectors, never direct cross-store mutation.
- **Naming**: PascalCase for components, camelCase for functions/variables, snake_case for Rust, SCREAMING_SNAKE for constants.
- **Files**: Component files match their export name (`AgentCard.tsx` exports `AgentCard`). One component per file.

### IPC Conventions

- Tauri commands are the only bridge between frontend and backend
- Commands are typed -- TypeScript bindings generated from Rust structs
- Events use the pattern `agent:<event-name>` for agent-related push events
- Frontend never accesses filesystem or spawns processes directly

---

## Agent Definitions

This project uses four Claude Code agents defined in `.claude/agents/`:

| Agent | Model | Role | Color |
|-------|-------|------|-------|
| `product-task-manager` | opus | Task decomposition, PRD authoring, prioritization | blue |
| `app-architect` | opus | Architecture design, tech stack decisions, implementation | red |
| `security-auditor` | opus | Threat modeling, vulnerability detection, security review | green |
| `agent-orchestrator` | opus | Multi-agent coordination, task delegation, integration | yellow |

Agent definitions use YAML frontmatter followed by a system prompt in markdown. The app reads these from `.claude/agents/` via filesystem watcher and displays them as available agent templates.

The project dogfoods itself -- these agents are building the very app that will orchestrate them.

---

## Competitive Landscape

Existing tools and our differentiation:

| Tool | What It Does | Gap We Fill |
|------|-------------|-------------|
| Spacecake | Desktop editor + embedded terminal + single-agent task tracking | Single-agent focus, no multi-agent orchestration, no workflow builder, no spec lifecycle |
| claude-code-kanban | Real-time Kanban monitoring | View-only, no control or orchestration |
| Claude Code Agentrooms | Multi-agent orchestration via @mentions | Web-based, no spec-driven development |
| claude-mpm | Subprocess orchestration + dashboard | No visual workflow builder, no spec management |
| CCO-MCP | Web dashboard + MCP security layer | Web-based, monitoring focus |
| Vibe Kanban | Kanban-style AI agent orchestration | No desktop app, no Claude Code native integration |
| claude-flow | Multi-agent swarm orchestration | CLI-first, no visual dashboard |
| LangGraph Studio | Visual graph editor for agents | Framework-specific (LangGraph), not Claude Code native |

**Our differentiation**: Desktop-first. Claude Code native. Combines monitoring + control + spec-driven development + visual workflows in a single app. No existing tool does all four.

---

## Open Questions

1. **Monetization model**: Open-source? Freemium? Affects whether we need a server component.
2. **Agent scope**: Claude Code only, or extensible to other AI agents (Cursor, Copilot)? Current plan: Claude Code first with adapter pattern.
3. **MCP Server mode**: Should Mission Control itself become an MCP server that agents connect to? Documented as Phase 2 extension point.
4. **Input streaming**: Claude Code supports `--input-format stream-json` for bidirectional streaming. Could enable sending messages to running agents without restarting. Evaluate after MVP.
5. **Multi-project support**: Single project or multiple? Current plan: single project for MVP, multi-project in Phase 3.
6. **Plugin architecture**: Third-party extensions for custom node renderers, log parsers, integrations. Phase 2 concern.
