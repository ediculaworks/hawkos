-- Add ML decision logging event types to activity_log
-- These enable future training of classifiers by collecting labeled examples
BEGIN;

-- Drop and recreate the CHECK constraint to add new event types
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_event_type_check;

ALTER TABLE activity_log ADD CONSTRAINT activity_log_event_type_check
  CHECK (event_type IN (
    'tool_call',
    'automation',
    'alert',
    'memory_created',
    'memory_merged',
    'session_committed',
    'command',
    'error',
    -- ML decision logging (Phase A)
    'module_detection',
    'dedup_decision'
  ));

COMMIT;
