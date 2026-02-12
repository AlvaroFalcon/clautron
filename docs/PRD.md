# Agents Mission Control - Product Requirements Document

**Version**: 0.1 (Initial)
**Date**: 2025-02-12
**Status**: Draft

---

## 1. Product Vision

Agents Mission Control is a desktop application that gives developers a visual command center for orchestrating, monitoring, and controlling Claude Code agents. It transforms the experience of working with multiple AI agents from a purely CLI-based, text-heavy workflow into a structured, visual, and controllable process.

**One-line pitch**: The IDE for agent orchestration -- see what your agents are doing, control how they work, and focus on writing specs instead of babysitting terminals.

---

## 2. Core User Personas

### Persona A: The Solo Developer ("The Power User")
- **Profile**: Individual developer or indie hacker using Claude Code agents to multiply their output.
- **Jobs-to-be-done**:
  - Run 2-5 agents in parallel on different tasks without losing track of what each is doing.
  - Quickly intervene when an agent goes down the wrong path (before it wastes tokens and time).
  - Write specs once and have agents execute them reliably.
  - Review agent outputs efficiently before committing.
- **Pain today**: Multiple terminal windows, no overview, context-switching overhead, hard to spot when an agent is stuck.

### Persona B: The Tech Lead ("The Orchestrator")
- **Profile**: Senior developer or tech lead coordinating agent-driven development across a larger project.
- **Jobs-to-be-done**:
  - Design multi-step workflows where agents hand off work to each other.
  - Maintain quality by reviewing what agents produce before it lands in the codebase.
  - Prioritize and sequence agent work against a backlog of specs.
  - Understand bottlenecks in agent execution.
- **Pain today**: No way to visualize agent dependencies, manual coordination overhead, difficult to enforce ordering.

### Persona C: The Spec Writer ("The Product Mind")
- **Profile**: Product-oriented developer or technical PM who wants to describe *what* to build, not *how* to build it.
- **Jobs-to-be-done**:
  - Write structured specifications that agents can consume.
  - Track which specs have been implemented, which are in progress, which are pending.
  - Iterate on specs based on agent output (review, refine, re-run).
- **Pain today**: Specs live in scattered markdown files, no linkage between spec and execution, no visibility into progress.

**Primary persona for MVP**: Persona A (Solo Developer). This covers the broadest audience and the most immediate pain. Personas B and C layer on top in v1.0 and v2.0.

---

## 3. Feature Categories (Prioritized)

### 3.1 MVP (Must-Have) -- "See and Control"

These features address the core pain: "I have agents running and I cannot see or control what they are doing."

| ID | Feature | Description | Value | Effort |
|----|---------|-------------|-------|--------|
| MVP-1 | **Agent Dashboard** | Real-time view of all running agents: name, status (idle/running/blocked/error/done), current task summary, elapsed time. | High | Medium |
| MVP-2 | **Agent Log Viewer** | Stream agent output (stdout/stderr) in real-time per agent. Searchable, filterable. Replaces watching raw terminal output. | High | Medium |
| MVP-3 | **Agent Start/Stop** | Launch new Claude Code agent sessions from the UI. Stop/cancel running agents. Basic lifecycle management. | High | Medium |
| MVP-4 | **Agent Detail View** | Drill into a single agent to see: full conversation history, files touched, commands run, current working context. | High | Medium |
| MVP-5 | **Project Context** | Connect to a local project directory. Auto-detect existing .claude agent configurations. Show project-level overview. | High | Small |
| MVP-6 | **Basic Notifications** | Desktop notifications when an agent completes, errors, or requires human input (e.g., permission prompt). | Medium | Small |
| MVP-7 | **Session Persistence** | Save/restore agent sessions across app restarts. Remember which agents were running and their state. | Medium | Medium |

**MVP acceptance criteria**: A developer can open the app, point it at a project, start 3 agents on different tasks, watch their progress in real-time, see when one errors, stop it, and review the outputs of the successful ones -- all without touching a terminal.

### 3.2 v1.0 (Should-Have) -- "Orchestrate and Spec"

These features move from passive monitoring to active orchestration and spec-driven development.

| ID | Feature | Description | Value | Effort |
|----|---------|-------------|-------|--------|
| V1-1 | **Spec Editor** | Built-in editor for writing structured task specifications. Markdown-based with frontmatter for metadata (priority, dependencies, acceptance criteria). | High | Medium |
| V1-2 | **Spec-to-Agent Binding** | Assign a spec to an agent for execution. Track spec status (draft/assigned/in-progress/review/done). | High | Medium |
| V1-3 | **Workflow Builder** | Define sequential and parallel agent workflows visually. "Agent A finishes task 1, then Agent B starts task 2." DAG-based dependency model. | High | Large |
| V1-4 | **Agent Relationship Diagram** | Visual diagram showing how agents relate to each other: dependencies, handoffs, shared resources. Live-updating. | Medium | Medium |
| V1-5 | **Output Review Panel** | Side-by-side view of what an agent changed: file diffs, new files created, commands executed. Approve/reject/request-revision flow. | High | Medium |
| V1-6 | **Agent Templates** | Pre-configured agent profiles (like the existing .claude/agents definitions) that can be instantiated quickly. "Start a security review agent", "Start a test writer agent". | Medium | Small |
| V1-7 | **Run History** | Searchable history of past agent runs: what was requested, what was produced, duration, token usage. | Medium | Medium |
| V1-8 | **Token/Cost Tracking** | Show token consumption per agent, per run, per project. Basic cost estimation. | Medium | Small |

### 3.3 v2.0+ (Nice-to-Have) -- "Scale and Integrate"

| ID | Feature | Description | Value | Effort |
|----|---------|-------------|-------|--------|
| V2-1 | **Built-in Claude Assistant** | Embed Claude inside the app itself for meta-tasks: "Which agent should handle this?", "Summarize what happened in the last hour.", "Why did agent X fail?" | High | Large |
| V2-2 | **Git Integration** | Show git state per agent. Auto-create branches per agent task. Visual merge/conflict resolution. | Medium | Large |
| V2-3 | **Team Collaboration** | Share agent configurations, specs, and run history across a team. Shared dashboards. | Medium | Large |
| V2-4 | **Plugin System** | Allow custom agent types, custom visualizations, custom workflow steps. Extension API. | Medium | Large |
| V2-5 | **Performance Analytics** | Historical trends: agent success rate, average completion time, cost per feature, bottleneck analysis. | Low | Medium |
| V2-6 | **CI/CD Integration** | Trigger agent workflows from CI/CD pipelines. Headless mode for automated agent runs. | Low | Large |
| V2-7 | **Multi-Project Support** | Manage agents across multiple projects from a single dashboard. | Low | Medium |
| V2-8 | **Conditional Workflows** | If/then logic in workflows: "If tests pass, deploy; if tests fail, assign to debug agent." | Medium | Large |

---

## 4. Key User Flows

### Flow 1: Starting a New Multi-Agent Task

```
1. User opens Agents Mission Control
2. User selects project directory (or app remembers last project)
3. App scans .claude/agents/ and displays available agent templates
4. User creates a new "Run" (a named session grouping multiple agents)
5. User selects agent templates to include (e.g., app-architect + security-auditor)
6. For each agent, user provides:
   - A task description (free text or link to a spec)
   - Optional: priority, timeout, dependencies on other agents
7. User clicks "Start Run"
8. Dashboard populates with agent cards showing real-time status
```

**Key design decision**: Should the user configure each agent individually, or describe a high-level goal and let the orchestrator agent decompose it? Recommendation: Start with explicit per-agent configuration (MVP), add intelligent decomposition later (v1.0 via the orchestrator).

### Flow 2: Monitoring Agent Progress

```
1. Dashboard shows all active agents as cards in a grid/list
2. Each card displays: agent name, status badge, current task summary,
   elapsed time, a mini activity indicator (spinner/progress)
3. User can sort/filter by status (running, blocked, errored, done)
4. Clicking an agent card opens the detail view:
   - Full conversation log (streaming in real-time)
   - Files touched (with change indicators)
   - Commands executed
   - Token usage for this session
5. A global activity feed shows events across all agents chronologically
```

### Flow 3: Intervening When Something Goes Wrong

```
1. An agent enters "error" or "blocked" state
2. Desktop notification fires; agent card turns red/yellow on dashboard
3. User clicks into the agent detail view
4. User sees the error context: last few messages, the failing command,
   the error output
5. User has options:
   a. Send a correction message to the agent ("Try using X instead")
   b. Stop the agent and reassign the task
   c. Stop the agent and edit the spec, then re-run
   d. Pause the agent (if it requested permission, approve/deny)
6. If user sends a correction, the agent resumes with updated context
```

**Critical UX requirement**: The time from "agent errors" to "user sees the problem and can act" must be under 5 seconds. This is the core value proposition over CLI.

### Flow 4: Writing and Managing Specs (v1.0)

```
1. User opens the Specs panel
2. User creates a new spec using the built-in editor
3. Spec includes: title, description, acceptance criteria, priority,
   estimated effort, dependencies
4. User can organize specs into groups/epics
5. User assigns a spec to an agent (or lets the orchestrator assign it)
6. Spec status updates as the agent works: draft -> assigned ->
   in-progress -> review -> done
7. When agent completes, the spec links to the run output for review
```

### Flow 5: Reviewing Agent Outputs

```
1. Agent completes a task and enters "review" state
2. User opens the Output Review panel
3. Panel shows:
   - Summary of what the agent did (auto-generated)
   - File diffs (additions, modifications, deletions)
   - Commands that were executed
   - Test results (if applicable)
4. User can:
   a. Approve: mark as done, optionally commit changes
   b. Request revision: send feedback to agent, agent resumes
   c. Reject: discard agent output, optionally reassign
5. Approved outputs are logged in run history
```

---

## 5. Data Model

### 5.1 Core Entities

```
Project
  - id: UUID
  - name: string
  - path: string (local filesystem path)
  - agentConfigPath: string (path to .claude/agents/)
  - createdAt: timestamp
  - settings: ProjectSettings

AgentTemplate
  - id: UUID
  - projectId: FK -> Project
  - name: string (from .claude/agents/*.md frontmatter)
  - model: string (opus, sonnet, etc.)
  - systemPrompt: text
  - color: string
  - source: "file" | "custom"
  - filePath: string (path to the .md definition)

Run
  - id: UUID
  - projectId: FK -> Project
  - name: string
  - status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled"
  - startedAt: timestamp
  - completedAt: timestamp | null
  - totalTokensUsed: number
  - estimatedCost: number

AgentInstance
  - id: UUID
  - runId: FK -> Run
  - templateId: FK -> AgentTemplate
  - status: "idle" | "starting" | "running" | "blocked" | "waiting_input"
            | "error" | "completed" | "cancelled"
  - taskDescription: text
  - priority: number
  - startedAt: timestamp
  - completedAt: timestamp | null
  - tokensUsed: number
  - processId: string (OS process reference)
  - exitCode: number | null

Spec (v1.0)
  - id: UUID
  - projectId: FK -> Project
  - title: string
  - body: markdown text
  - acceptanceCriteria: text[]
  - priority: "P0" | "P1" | "P2"
  - status: "draft" | "assigned" | "in_progress" | "review" | "done" | "rejected"
  - assignedAgentInstanceId: FK -> AgentInstance | null
  - parentSpecId: FK -> Spec | null (for epic/subtask hierarchy)
  - createdAt: timestamp
  - updatedAt: timestamp

LogEntry
  - id: UUID
  - agentInstanceId: FK -> AgentInstance
  - timestamp: timestamp
  - type: "stdout" | "stderr" | "system" | "user_message" | "agent_message"
          | "tool_call" | "tool_result" | "error"
  - content: text
  - metadata: JSON (tool name, file paths, etc.)

FileChange
  - id: UUID
  - agentInstanceId: FK -> AgentInstance
  - filePath: string
  - changeType: "created" | "modified" | "deleted"
  - diff: text | null
  - timestamp: timestamp

WorkflowDefinition (v1.0)
  - id: UUID
  - projectId: FK -> Project
  - name: string
  - steps: WorkflowStep[] (DAG structure)
  - createdAt: timestamp

WorkflowStep (v1.0)
  - id: UUID
  - workflowId: FK -> WorkflowDefinition
  - agentTemplateId: FK -> AgentTemplate
  - taskDescription: text
  - dependsOn: WorkflowStep[] (edges in the DAG)
  - specId: FK -> Spec | null
```

### 5.2 Key Relationships

```
Project 1--* AgentTemplate     (a project has many agent templates)
Project 1--* Run               (a project has many runs)
Project 1--* Spec              (a project has many specs)
Run 1--* AgentInstance         (a run has many agent instances)
AgentTemplate 1--* AgentInstance (a template spawns many instances)
AgentInstance 1--* LogEntry    (an agent produces many log entries)
AgentInstance 1--* FileChange  (an agent touches many files)
Spec 0..1--1 AgentInstance     (a spec can be assigned to one agent instance)
Spec 0..1--* Spec              (specs can have parent/child hierarchy)
WorkflowDefinition 1--* WorkflowStep
WorkflowStep *--* WorkflowStep (dependency edges)
```

### 5.3 State That Must Be Tracked

**Real-time (in-memory, streamed to UI)**:
- Agent status transitions
- Log entry stream (stdout/stderr from each agent process)
- Token consumption counters
- Active file being edited by each agent

**Persisted (local database)**:
- Run history and outcomes
- Agent session conversations
- File change records
- Spec content and status
- Workflow definitions
- Project settings and preferences

**Derived (computed on demand)**:
- Cost estimates (tokens x model pricing)
- Run duration statistics
- Agent success/failure rates
- Spec completion percentages

---

## 6. Competitive Differentiation

### 6.1 What Makes This Different from Spacecake?

Spacecake (spacecake-labs/spacecake) is the closest comparable tool -- an
Electron-based desktop app for Claude Code with an embedded Ghostty terminal,
Lexical rich-text editor, and live task tracking. Key differences:

| Dimension | Spacecake | Agents Mission Control |
|-----------|-----------|----------------------|
| **Agent model** | Single agent, single workspace | Multi-agent orchestration with concurrent sessions |
| **Workflow** | No workflow builder | Visual DAG-based workflow builder (ReactFlow) |
| **Spec management** | No spec lifecycle | Full spec lifecycle (draft -> assigned -> review -> done) |
| **Editor focus** | Primary focus is document editing (Lexical WYSIWYG) | Primary focus is agent monitoring and control |
| **Framework** | Electron (~150MB binary) | Tauri (~10MB binary, Rust backend) |
| **Terminal** | Embedded Ghostty (core feature) | Optional -- structured dashboard is primary view |

Spacecake is an excellent single-agent coding companion. Mission Control is
a multi-agent command center. They serve different workflows.

**Inspired by Spacecake**: We adopt several of their proven library choices --
`react-resizable-panels` for split pane layout, `@tanstack/react-virtual` for
list virtualization, `cmdk` for command palette, and `sonner` for notifications.
We also add Mermaid for static diagram rendering in specs and logs, complementing
our interactive ReactFlow workflow builder.

### 6.2 What Makes This Different from Using Claude Code CLI Directly?

| Dimension | Claude Code CLI | Agents Mission Control |
|-----------|----------------|----------------------|
| **Visibility** | One terminal per agent, text-only | Unified dashboard, all agents at a glance |
| **Intervention speed** | Must notice the problem in scrolling text, switch terminals | Instant visual status + desktop notifications, one-click drill-down |
| **Orchestration** | Manual: user starts each agent, manages dependencies mentally | Visual workflow builder, automatic sequencing, dependency management |
| **Spec management** | Specs are just text files, no linkage to execution | Structured specs with lifecycle tracking, linked to agent runs |
| **Review** | Read raw output in terminal, manually check file changes | Structured review panel with diffs, approve/reject/revise flow |
| **History** | Ephemeral -- lost when terminal closes | Persistent run history, searchable, auditable |
| **Cost awareness** | No visibility into token usage | Real-time token/cost tracking per agent and per run |

### 6.3 Unique Value Proposition

**"Stop babysitting terminals. Start commanding agents."**

The core insight: as AI agents become more capable, the bottleneck shifts from *writing code* to *orchestrating, monitoring, and reviewing agent work*. Agents Mission Control is purpose-built for this new workflow where the developer's job is to:

1. Define *what* needs to be built (specs)
2. Assign the right agent to each task (orchestration)
3. Monitor progress and intervene when needed (supervision)
4. Review and approve outputs (quality control)

This is fundamentally different from an IDE (which helps you write code) or a terminal (which gives you raw access). It is a management layer for AI-assisted development.

### 6.4 Why Not Just Build a VS Code Extension?

A dedicated desktop app makes sense because:
- Agent orchestration is a *parallel* activity to coding, not embedded within it.
- The dashboard needs persistent screen real estate (a second monitor use case).
- Workflow visualization and multi-agent monitoring require more space than a sidebar.
- It avoids coupling to any specific editor, keeping it usable alongside VS Code, Cursor, Neovim, etc.

However, VS Code extension integration (v2.0+) could complement the desktop app by providing lightweight status indicators inside the editor.

---

## 7. Risks and Open Questions

### 7.1 Technical Feasibility Concerns

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Claude Code CLI API stability**: The app depends on being able to programmatically start, stop, and read output from Claude Code agent processes. If the CLI has no stable API for this, the integration becomes fragile. | HIGH | Investigate Claude Code's process model early. Prototype the agent process management layer first (before any UI). If no stable API exists, consider contributing upstream or building an adapter layer. |
| **Real-time log streaming performance**: Streaming stdout from multiple concurrent agent processes into the UI could cause performance issues with high output volume. | MEDIUM | Use a ring buffer per agent (keep last N lines in memory, persist to disk). Virtual scrolling in the log viewer. Throttle UI updates to 10-30fps. |
| **Local database choice**: Need a lightweight embedded database that works well in a desktop app context and handles concurrent writes from multiple agent streams. | LOW | SQLite (via better-sqlite3 or Drizzle+SQLite) is the natural choice. Well-proven in Electron/Tauri apps. |
| **Process management across platforms**: Starting/stopping/monitoring OS processes behaves differently on macOS, Windows, and Linux. | MEDIUM | Use Node.js child_process with proper signal handling. Test on all platforms early. Consider using a process manager library. |

### 7.2 UX Complexity Challenges

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Information overload**: With multiple agents running, each producing logs, file changes, and status updates, the UI could become overwhelming. | HIGH | Progressive disclosure: dashboard shows summary, details on drill-down. Smart defaults for what to show. Configurable verbosity levels. Focus mode (single agent). |
| **Workflow builder complexity**: Visual DAG editors are notoriously hard to build well. | MEDIUM | Start simple: linear sequences only in MVP, add parallel branches in v1.0, full DAG in v2.0. Use an existing graph visualization library (e.g., reactflow) rather than building from scratch. |
| **Notification fatigue**: Too many notifications become noise. | LOW | Smart notification rules: only notify on errors and completion by default. User-configurable thresholds. Batch non-critical notifications. |

### 7.3 Integration Challenges with Claude Code

| Risk | Severity | Mitigation |
|------|----------|------------|
| **No official programmatic API**: Claude Code may be designed as an interactive CLI, not a programmatic tool. Scraping terminal output is brittle. | HIGH | This is the single biggest technical risk. Must investigate early: Does Claude Code support JSON output mode? Can it be driven via stdin? Is there a library/SDK? If not, building a reliable adapter is the first engineering task. |
| **Agent context/memory management**: The app needs to understand agent memory (.claude/agent-memory/) to display context, but the format may change. | MEDIUM | Read but do not write agent memory from the app. Treat the file format as an external dependency. Abstract behind an adapter that can be updated if the format changes. |
| **Permission/approval flow**: Claude Code agents sometimes ask for user permission (e.g., to run dangerous commands). The app must intercept and surface these. | HIGH | Must detect "waiting for input" states in the agent process. This likely requires parsing the agent's output stream for specific patterns or signals. Fragile without an official API. |

### 7.4 Open Questions Requiring Decision

1. **Desktop framework**: Electron vs Tauri vs something else? Tauri is lighter weight and more performant, but Electron has a larger ecosystem. Recommendation: Evaluate both with a spike. Lean toward Tauri for performance, unless a critical dependency requires Node.js in the main process.

2. **Claude Code integration approach**: Direct process management vs. wrapper/adapter vs. waiting for an official API/SDK? This must be answered in the first week of development.

3. **Data storage**: Local-only (SQLite) vs. optional cloud sync? Recommendation: Local-only for MVP and v1.0. Cloud sync is a v2.0+ concern and brings significant complexity.

4. **Monetization model** (if applicable): Open-source? Freemium? This affects architectural decisions (e.g., whether to build a server component).

5. **Scope of "agent"**: Does this only support Claude Code agents, or should it be extensible to other AI coding agents (Copilot, Cursor agents, etc.)? Recommendation: Build for Claude Code first, but use an adapter pattern that does not preclude other agent types later.

---

## 8. Technical Architecture Sketch

```
+---------------------------------------------------+
|              Desktop Application (Tauri v2)         |
|                                                    |
|  +-------------+  +----------------------------+  |
|  | Dashboard UI |  | Agent Detail / Log Viewer  |  |
|  | (React)      |  | (React)                    |  |
|  +------+------+  +------------+---------------+  |
|         |                      |                   |
|  +------+----------------------+---------------+   |
|  |           State Management (Zustand)        |   |
|  +------+----------------------+---------------+   |
|         |                      |                   |
|  +------+------+  +------------+---------------+   |
|  | Agent       |  | Spec Manager / Workflow    |   |
|  | Process Mgr |  | Engine                     |   |
|  +------+------+  +------------+---------------+   |
|         |                      |                   |
|  +------+----------------------+---------------+   |
|  |           Local Database (SQLite)           |   |
|  +---------------------------------------------+  |
+---------------------------------------------------+
         |
         | (child processes, stdin/stdout)
         |
+--------+--------+  +--------+--------+
| Claude Code     |  | Claude Code     |
| Agent Process 1 |  | Agent Process 2 |
+-----------------+  +-----------------+
```

**Frontend UI toolkit**:
- **react-resizable-panels**: Split pane layout (sidebar, dashboard, detail, logs)
- **@tanstack/react-virtual**: Virtualized lists for log streams and file trees
- **cmdk**: Command palette (Cmd+K) for quick navigation and actions
- **sonner**: Toast notifications for agent events and errors
- **lucide-react**: Consistent icon set
- **ReactFlow**: Interactive workflow builder (v1.0)
- **Mermaid**: Static diagram rendering in specs and agent output
- **CodeMirror 6**: Spec editor with markdown syntax highlighting

**Key architectural principle**: The Agent Process Manager is the most critical and highest-risk component. It must be built and validated first, before any UI work begins. Everything else depends on its ability to reliably start, monitor, communicate with, and stop Claude Code agent processes.

---

## 9. Recommended Development Sequence

### Iteration 0: Technical Validation (1-2 weeks)
- Spike: Can we programmatically control Claude Code agents?
- Spike: Process management prototype (start, read output, stop)
- Decision: Desktop framework (Tauri vs Electron)
- Decision: Claude Code integration approach

### Iteration 1: Skeleton + Agent Process Manager (1-2 weeks)
- Set up desktop app scaffold (chosen framework, React, build pipeline)
- Implement Agent Process Manager (start/stop/stream output)
- Basic dashboard shell (agent cards with hardcoded data, then real data)
- Local database setup (SQLite schema for runs, instances, logs)

### Iteration 2: Live Dashboard (1-2 weeks)
- Real-time agent status on dashboard
- Log viewer with streaming
- Agent start/stop from UI
- Desktop notifications

### Iteration 3: Agent Detail + Session Management (1-2 weeks)
- Agent detail view (conversation history, files touched)
- Session persistence (save/restore across restarts)
- Project context (auto-detect .claude/agents/)
- Token usage tracking

### Iteration 4: Spec Management (2-3 weeks)
- Spec editor
- Spec lifecycle management
- Spec-to-agent binding
- Output review panel with diffs

### Iteration 5: Workflow Engine (2-3 weeks)
- Workflow definition model (DAG)
- Basic visual workflow builder
- Workflow execution engine
- Agent relationship diagram

---

## 10. Success Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Time from agent error to user awareness | < 5 seconds | Core value prop vs CLI |
| Number of agents manageable simultaneously | 5+ comfortably | Validates the dashboard concept |
| Time to start a new multi-agent run | < 60 seconds | Must be faster than opening multiple terminals |
| Session restore time | < 3 seconds | App must feel snappy |
| Agent output review time | 50% faster than CLI review | Validates the review panel concept |

---

## Appendix A: Existing Project Assets

The project already contains four agent definitions in `.claude/agents/`:

1. **product-task-manager** (model: opus, color: blue) -- Task decomposition and prioritization
2. **app-architect** (model: opus, color: red) -- Application architecture and implementation
3. **security-auditor** (model: opus, color: green) -- Security review and vulnerability detection
4. **agent-orchestrator** (model: opus, color: yellow) -- Multi-agent workflow coordination

These serve as both:
- Real content for the app to manage (the project is building itself with agents)
- Test fixtures for development (known agent configurations to test against)

This "dogfooding" dynamic is a strength -- the development process itself validates the product.
