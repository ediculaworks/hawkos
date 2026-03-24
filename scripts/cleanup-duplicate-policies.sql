-- Clean up duplicate RLS policies created by manual migrations
-- Run this in Supabase SQL Editor before re-running bun db:migrate

BEGIN;

-- Drop existing policies that will be recreated by migrations
DROP POLICY IF EXISTS "Allow read access" ON conversation_messages;
DROP POLICY IF EXISTS "Service role full access" ON activity_log;
DROP POLICY IF EXISTS "Authenticated read" ON activity_log;
DROP POLICY IF EXISTS "Service role full access" ON session_archives;
DROP POLICY IF EXISTS "Allow insert for service role" ON conversation_messages;

-- Also clean up any duplicate agent_templates policies
DROP POLICY IF EXISTS "Allow public read access" ON agent_templates;
DROP POLICY IF EXISTS "Allow service role write access" ON agent_templates;

-- And agent_conversations
DROP POLICY IF EXISTS "Allow public read access" ON agent_conversations;
DROP POLICY IF EXISTS "Allow service role write access" ON agent_conversations;

-- And session_memories
DROP POLICY IF EXISTS "Allow public read access" ON session_memories;
DROP POLICY IF EXISTS "Allow service role write access" ON session_memories;

-- And agent_status
DROP POLICY IF EXISTS "Allow public read access" ON agent_status;
DROP POLICY IF EXISTS "Allow service role write access" ON agent_status;

COMMIT;

-- After running this, execute: bun db:migrate
