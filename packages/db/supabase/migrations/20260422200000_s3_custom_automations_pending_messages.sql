-- S3.2 — Custom Automations (Natural Language Cron)
-- S3.4 — Pending Messages (Offline Resilience)

BEGIN;

-- ── Custom Automations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS custom_automations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  message     TEXT NOT NULL,          -- message to send to the agent when fired
  cron_expr   TEXT NOT NULL,          -- cron expression (e.g. "0 9 * * 1")
  description TEXT,                   -- human-readable schedule (e.g. "Toda segunda às 9h")
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_automations_enabled_idx ON custom_automations (enabled) WHERE enabled = true;

CREATE OR REPLACE FUNCTION update_custom_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS custom_automations_updated_at ON custom_automations;
CREATE TRIGGER custom_automations_updated_at
  BEFORE UPDATE ON custom_automations
  FOR EACH ROW EXECUTE FUNCTION update_custom_automations_updated_at();

ALTER TABLE custom_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all for tenant" ON custom_automations USING (true);

-- ── Pending Messages ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pending_messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel            TEXT NOT NULL DEFAULT 'discord',
  channel_message_id TEXT NOT NULL,           -- Discord message ID (idempotency key)
  session_id         TEXT NOT NULL,            -- channelId used as sessionId
  content            TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processed', 'expired')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_messages_channel_msg_id_idx ON pending_messages (channel_message_id);
CREATE INDEX IF NOT EXISTS pending_messages_status_created_idx ON pending_messages (status, created_at) WHERE status = 'pending';

ALTER TABLE pending_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all for tenant" ON pending_messages USING (true);

COMMIT;
