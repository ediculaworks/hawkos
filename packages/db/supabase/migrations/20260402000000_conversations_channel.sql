-- Add channel column to agent_conversations to track session origin (web vs discord)
BEGIN;

ALTER TABLE agent_conversations
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'web'
  CHECK (channel IN ('web', 'discord'));

CREATE INDEX IF NOT EXISTS idx_agent_conversations_channel
ON agent_conversations (channel);

-- Backfill existing Discord sessions that only exist in conversation_messages
INSERT INTO agent_conversations (session_id, channel, started_at, last_message_at, title)
SELECT
  cm.session_id,
  'discord',
  MIN(cm.created_at),
  MAX(cm.created_at),
  LEFT(MIN(CASE WHEN cm.role = 'user' THEN cm.content END), 47)
FROM conversation_messages cm
WHERE cm.channel = 'discord'
  AND cm.session_id::text NOT IN (SELECT session_id FROM agent_conversations)
GROUP BY cm.session_id
ON CONFLICT (session_id) DO NOTHING;

COMMIT;
