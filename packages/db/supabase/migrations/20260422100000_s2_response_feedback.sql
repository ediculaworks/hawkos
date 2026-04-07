-- S2.3 — Response feedback via Discord reactions
-- Stores 👍/👎 reactions on bot responses for LLM quality tracking.

BEGIN;

CREATE TABLE IF NOT EXISTS response_feedback (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id     TEXT NOT NULL,           -- Discord message ID
  rating         SMALLINT NOT NULL CHECK (rating IN (1, -1)),  -- 1=👍, -1=👎
  module_id      TEXT,                    -- module associated with the response
  session_id     TEXT,                    -- session that produced the response
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS response_feedback_created_at_idx ON response_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS response_feedback_module_id_idx  ON response_feedback (module_id) WHERE module_id IS NOT NULL;

ALTER TABLE response_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all for tenant" ON response_feedback USING (true);

COMMIT;
