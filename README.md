# Clautron

**Stop babysitting terminals. Start commanding agents.**

Clautron is a macOS desktop app for orchestrating, monitoring, and controlling [Claude Code](https://docs.anthropic.com/en/docs/claude-code) agents. It replaces the workflow of juggling multiple terminal windows with a unified visual command center.

As AI agents become more capable, the bottleneck shifts from writing code to orchestrating, monitoring, and reviewing agent work. This app is purpose-built for that workflow -- define what to build (specs), assign agents, monitor progress, intervene when needed, and review outputs.

---

## Features

### Live Agent Dashboard
- Real-time status cards for all running agents
- Start, stop, and resume agents from the UI
- Desktop notifications for completions, errors, and status changes
- Token usage and cost tracking per agent

### Agent Detail View
- Full conversation history with streaming updates
- Tools used, files touched, and commands executed
- Session persistence across app restarts

### Spec-Driven Development
- Markdown spec editor with YAML frontmatter (powered by CodeMirror 6)
- Spec lifecycle management: draft -> assigned -> in_progress -> review -> done
- Bind specs to agents and launch execution directly from specs

### Git Review Panel
- Diff viewer for agent-generated changes
- Approve, reject, or request revisions on agent output

### Visual Workflow Builder
- DAG-based workflow engine for multi-step agent pipelines
- Drag-and-drop workflow canvas (powered by ReactFlow)
- Define agent dependencies, execution order, and handoff logic
- Start, stop, and validate workflows from the UI

### Session History & Cost Dashboard
- Search, filter, and sort past sessions
- Cost breakdowns by agent and model
- Full session replay

### Security-First Design
- No shell injection -- all processes spawned with argument arrays, never interpolated strings
- Environment variable stripping with minimal allowlist
- Automatic log redaction for API keys, tokens, and credentials
- Agent approval system with SHA-256 hash verification
- Strict Content Security Policy
- File permissions enforced (0600 config, 0700 data dir)

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              React Frontend                  │
│  Zustand stores + Radix UI + Tailwind v4    │
├─────────────────────────────────────────────┤
│           Tauri IPC Bridge                   │
│    Commands (req/res) + Events (push)        │
├─────────────────────────────────────────────┤
│             Rust Backend                     │
│  Hexagonal architecture (ports & adapters)   │
│  SQLite + Process management + File watchers │
└─────────────────────────────────────────────┘
```

**Three strict layers:**

1. **Rust Backend** (`src-tauri/`) -- All process management, file I/O, SQLite, filesystem watchers. The frontend never directly spawns processes or reads files.
2. **IPC Bridge** -- Tauri commands (request/response) + Tauri events (push-based streaming).
3. **React Frontend** (`src/`) -- Pure presentation and interaction. Receives data via events, sends commands via `invoke()`.

The backend follows **hexagonal architecture** with 5 port traits (AgentRunner, EventEmitter, LogRepository, SessionRepository, WorkflowRepository) and swappable adapters.

### Claude Code Integration

Each agent session is a child process using structured JSON streaming:

```
claude --print --output-format stream-json --verbose --session-id <uuid> "<prompt>"
```

Output is parsed through a three-tier buffering pipeline:

```
Claude stdout -> Rust BufReader (JSON per line)
  -> Ring Buffer (10k entries/agent, batch emit every 100ms)
  -> React Frontend (requestAnimationFrame batched, virtualized rendering)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 |
| Frontend | React 19 + TypeScript |
| Build | Vite 7 |
| State management | Zustand 5 |
| UI components | Radix UI + Tailwind CSS v4 |
| Panel layout | react-resizable-panels |
| Workflow visualization | ReactFlow (@xyflow/react) |
| Spec editor | CodeMirror 6 |
| Database | SQLite (via sqlx) |
| Virtualized lists | @tanstack/react-virtual |
| Command palette | cmdk |
| Notifications | sonner |
| Icons | lucide-react |

---

## Prerequisites

- **macOS** (Windows/Linux support planned -- Tauri is cross-platform by design)
- **Node.js** >= 18
- **Rust** >= 1.75 (install via [rustup](https://rustup.rs/))
- **Claude Code CLI** installed and authenticated (`npm install -g @anthropic-ai/claude-code`)

### System Dependencies (macOS)

Tauri requires some system libraries. Install via Homebrew if you don't have them:

```bash
xcode-select --install  # Xcode Command Line Tools
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/clautron.git
cd clautron
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run in development mode

```bash
npm run tauri dev
```

This starts both the Vite dev server (frontend HMR) and the Tauri Rust backend. The app window will open automatically.

### 4. Build for production

```bash
npm run tauri build
```

The output binary will be in `src-tauri/target/release/bundle/`.

---

## Project Structure

```
clautron/
├── src/                          # React frontend
│   ├── components/
│   │   ├── layout/               # Sidebar, WelcomeScreen, CommandPalette
│   │   ├── dashboard/            # AgentCard, DashboardView, StartAgentDialog
│   │   ├── agents/               # AgentDetailPanel, ConversationTab, ToolsTab
│   │   ├── specs/                # SpecsView, SpecEditor
│   │   ├── workflow/             # WorkflowCanvas, WorkflowSidebar, AgentNode
│   │   ├── review/               # ReviewPanel, DiffViewer
│   │   ├── history/              # SessionHistoryView, CostDashboard
│   │   └── logs/                 # AgentLogViewer, LogFilter
│   ├── stores/                   # Zustand stores (agent, spec, workflow)
│   ├── hooks/                    # useAgentEvents, useSpecEvents, useWorkflowEvents
│   └── lib/                      # Types, Tauri bindings, formatters
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── domain/               # Core: SessionManager, ports, models, stream parser
│   │   ├── adapters/             # Infrastructure: CLI runner, SQLite repos, event emitter
│   │   ├── commands/             # Tauri IPC handlers
│   │   ├── services/             # Config, agent watcher, spec manager, workflow engine
│   │   └── migrations/           # SQLite schema migrations
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── docs/                         # Architecture docs, PRD
└── .claude/agents/               # Agent definitions (YAML + markdown)
```

---

## Development

### Useful Commands

```bash
# Start dev mode (frontend + backend with hot reload)
npm run tauri dev

# Build production binary
npm run tauri build

# Frontend only (no Tauri backend)
npm run dev

# Type check
npx tsc --noEmit
```

### Agent Definitions

Agent templates live in `.claude/agents/` as YAML frontmatter + markdown system prompts. The app watches this directory and displays available agents in the UI. When opening a project for the first time, you'll be prompted to approve any agent definitions before they can be used.

---

## Contributing

Contributions are welcome! Here's how to get started:

### Reporting Issues

- Use [GitHub Issues](../../issues) to report bugs or suggest features
- Include your OS version, app version, and steps to reproduce

### Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Ensure the app builds: `npm run tauri build`
5. Commit with a clear message describing what and why
6. Open a Pull Request against `main`

### Development Guidelines

- **Rust backend**: Follow `rustfmt` conventions. Use `thiserror` for errors. All public functions need `///` doc comments.
- **TypeScript frontend**: Strict mode, no `any`. Prefer interfaces for object shapes. Functional components only.
- **Security**: Review the [security requirements](CLAUDE.md#security-requirements) before submitting. Never use `exec()` with interpolated strings, never render agent output as HTML, always redact credentials in logs.
- **Architecture**: Keep the three-layer separation strict. Frontend never spawns processes or reads files directly.

### Areas Where Help Is Needed

- **Cross-platform support**: Testing and fixes for Windows and Linux
- **Test coverage**: Unit tests for Rust domain logic, React component tests
- **Performance profiling**: Memory and CPU usage with many concurrent agents
- **Accessibility**: Keyboard navigation, screen reader support
- **Documentation**: Tutorials, guides, and API documentation

---

## Roadmap

- [x] Live agent dashboard with real-time streaming
- [x] Agent start/stop/resume controls
- [x] Session persistence and resume
- [x] Spec-driven development workflow
- [x] Git diff review panel
- [x] Visual workflow builder (DAG)
- [x] Session history and cost tracking
- [ ] Cross-platform support (Windows, Linux)
- [ ] Per-agent filesystem sandboxing
- [ ] Process resource limits (CPU, memory, timeout)
- [ ] Signed auto-updates
- [ ] MCP server allowlisting
- [ ] Plugin architecture for extensions
- [ ] Multi-project support

---

## License

[MIT](LICENSE)
