-- S4 — Observabilidade
-- Adiciona event type assistance_failure ao activity_log.

BEGIN;

-- Expand activity_log event_type constraint to include assistance_failure
ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_event_type_check;

ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_event_type_check
  CHECK (event_type IN (
    -- Original
    'tool_call',
    'automation',
    'alert',
    'memory_created',
    'memory_merged',
    'session_committed',
    'command',
    'error',
    -- Wave 4 (existing)
    'tool_approved',
    'tool_denied',
    -- Wave 4 remaining
    'security',
    'automation_skipped',
    'module_detection',
    'session_cost',
    'client_error',
    -- S4
    'assistance_failure'
  ));

-- Index for assistance_failure queries (error budget dashboard)
CREATE INDEX IF NOT EXISTS activity_log_assistance_failure_idx
  ON activity_log (created_at DESC)
  WHERE event_type = 'assistance_failure';

COMMIT;
