-- RLS policy for conversation_messages table
-- This allows SELECT queries to return results when RLS is enabled

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access" ON conversation_messages;
CREATE POLICY "Allow read access" ON conversation_messages
  FOR SELECT USING (true);
