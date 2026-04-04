-- Migration: Remove hardcoded 6-slot tenant limit
-- The tenant_availability VIEW was hardcoded with VALUES (1,'ten1')...(6,'ten6').
-- Now tenants are created dynamically with auto-generated slugs (ten1, ten2, ..., tenN).
-- The agent runs as a single multi-tenant process — no per-tenant containers or ports needed.

BEGIN;

-- Drop the hardcoded VIEW if it exists
DROP VIEW IF EXISTS admin.tenant_availability;

-- Create a dynamic view that lists existing tenants + availability info
CREATE OR REPLACE VIEW admin.tenant_availability AS
SELECT
  ROW_NUMBER() OVER (ORDER BY t.slug) AS slot_number,
  t.slug AS slot_name,
  'occupied'::text AS status,
  t.id AS tenant_id,
  t.label AS tenant_label,
  t.status AS tenant_status,
  t.onboarding_completed_at,
  t.created_at
FROM admin.tenants t
ORDER BY t.slug;

-- Make agent_port nullable (no longer required in multi-tenant single-process mode)
ALTER TABLE admin.tenants ALTER COLUMN agent_port DROP NOT NULL;

COMMIT;
