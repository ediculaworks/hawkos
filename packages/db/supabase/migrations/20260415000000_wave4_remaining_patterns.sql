-- Wave 4 Remaining Patterns Migration
-- Secret redaction, prompt injection scanning, error codes,
-- [SILENT] cron, fault isolation, platform hints, tool pair sanitization
BEGIN;

-- ═══════════════════════════════════════════════════════════
-- 1. Expand activity_log event_type constraint
--    New types: security, automation_skipped, module_detection, session_cost, client_error
-- ═══════════════════════════════════════════════════════════

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
    'client_error'
  ));

-- ═══════════════════════════════════════════════════════════
-- 2. Add new feature flags defaults comment
--    (Actual flags stored in tenants.feature_flags JSONB,
--     defaults defined in @hawk/shared/feature-flags.ts)
--    New flags: secret-redaction, prompt-injection-scanning,
--              silent-cron, platform-hints
-- ═══════════════════════════════════════════════════════════

-- No schema change needed — flags are JSONB in tenants table.
-- This is documented here for migration history.

COMMIT;
