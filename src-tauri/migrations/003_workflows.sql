-- DAG-based workflow definitions

CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_steps (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'sonnet',
    prompt TEXT NOT NULL,
    spec_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    session_id TEXT,
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_edges (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    source_step_id TEXT NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
    target_step_id TEXT NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
    UNIQUE(source_step_id, target_step_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow ON workflow_edges(workflow_id);
