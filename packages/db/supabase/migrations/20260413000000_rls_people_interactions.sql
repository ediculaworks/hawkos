-- Fix: Enable RLS on people and interactions tables.
-- These tables were created in 20260316000011_people.sql without RLS.
-- FORCE was applied later in 20260326000001_force_rls_all_tables.sql,
-- but FORCE without ENABLE has no effect.

BEGIN;

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (used by agent and server actions)
CREATE POLICY "service_role_full_people" ON people
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_interactions" ON interactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users read/write (tenant isolation via schema search_path)
CREATE POLICY "authenticated_all_people" ON people
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all_interactions" ON interactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
