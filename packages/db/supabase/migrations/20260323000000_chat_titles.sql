-- Add title column to agent_conversations for chat session titles
BEGIN;

ALTER TABLE agent_conversations 
ADD COLUMN IF NOT EXISTS title TEXT;

COMMIT;
