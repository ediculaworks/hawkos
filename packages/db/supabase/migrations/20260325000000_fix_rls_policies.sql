-- Fix RLS policies from Wave 1
-- NOTE: Requires prior migrations 20260319000000 and 20260319000001 to be applied first
BEGIN;

-- Fix 1: activity_log RLS policies (table has no policies = all access blocked)
DROP POLICY IF EXISTS "Service role full access" ON activity_log;
CREATE POLICY "Service role full access" ON activity_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read" ON activity_log;
CREATE POLICY "Authenticated read" ON activity_log
  FOR SELECT TO authenticated, anon USING (true);

-- Fix 2: session_archives RLS policies (table has no policies = all access blocked)
DROP POLICY IF EXISTS "Service role full access" ON session_archives;
CREATE POLICY "Service role full access" ON session_archives
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Fix 3: conversation_messages missing INSERT policy
DROP POLICY IF EXISTS "Allow insert for service role" ON conversation_messages;
CREATE POLICY "Allow insert for service role" ON conversation_messages
  FOR INSERT TO service_role WITH CHECK (true);

COMMIT;
