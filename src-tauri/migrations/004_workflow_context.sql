-- Add context-passing support to workflow steps.
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so we use a CREATE TABLE trick: create a temp marker table to detect if
-- migration has already run, then conditionally skip.
-- However the simplest robust approach is to just put the columns in a
-- new table and copy data. Instead, we rely on the runner ignoring
-- "duplicate column name" errors for ALTER TABLE statements.
--
-- NOTE: These statements are handled specially by init() which ignores
-- "duplicate column name" errors on ALTER TABLE.
ALTER TABLE workflow_steps ADD COLUMN pass_context INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workflow_steps ADD COLUMN result_output TEXT;
