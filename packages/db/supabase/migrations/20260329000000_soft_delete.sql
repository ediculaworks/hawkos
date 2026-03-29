BEGIN;

-- Add deleted_at to tables that currently hard-delete
ALTER TABLE health_observations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Indexes for soft-delete filtering
CREATE INDEX IF NOT EXISTS idx_health_obs_not_deleted ON health_observations(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sleep_not_deleted ON sleep_sessions(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workout_not_deleted ON workout_sessions(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_not_deleted ON calendar_events(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_interactions_not_deleted ON interactions(id) WHERE deleted_at IS NULL;

COMMIT;
