-- Migration: Fix Phase 5 schema gaps — part 2
-- residences: add is_primary
-- maintenance_logs: add category, done_at, next_due_at

ALTER TABLE residences
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

ALTER TABLE maintenance_logs
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS done_at DATE,
  ADD COLUMN IF NOT EXISTS next_due_at DATE;

-- Sync existing date → done_at
UPDATE maintenance_logs SET done_at = date WHERE done_at IS NULL;

-- Set primary residence from seed (Apto BH should be primary)
UPDATE residences SET is_primary = true WHERE name = 'Apto BH' AND is_primary = false;
