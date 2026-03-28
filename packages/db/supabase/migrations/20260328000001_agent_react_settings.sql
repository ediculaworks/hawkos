-- Add ReAct and cost tracking settings to agent_settings
BEGIN;

ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS react_mode TEXT NOT NULL DEFAULT 'auto'
  CHECK (react_mode IN ('auto', 'always', 'never'));
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS cost_tracking_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS history_compression_enabled BOOLEAN NOT NULL DEFAULT true;

COMMIT;
