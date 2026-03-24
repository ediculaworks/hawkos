-- Migration: Fix Phase 5 schema gaps
-- housing_bills: add status, reference_month, paid_at, notes
-- documents: add expires_at, description, asset_id, tags (aligning with queries)

-- ─── residences ──────────────────────────────────────────────────────────────

ALTER TABLE residences
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- ─── maintenance_logs ─────────────────────────────────────────────────────────

ALTER TABLE maintenance_logs
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS done_at DATE,
  ADD COLUMN IF NOT EXISTS next_due_at DATE;

-- Sync existing date → done_at
UPDATE maintenance_logs SET done_at = date WHERE done_at IS NULL;

-- ─── housing_bills ───────────────────────────────────────────────────────────

ALTER TABLE housing_bills
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue')),
  ADD COLUMN IF NOT EXISTS reference_month TEXT,   -- YYYY-MM
  ADD COLUMN IF NOT EXISTS paid_at DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_housing_bills_status
  ON housing_bills (status, reference_month);

-- ─── documents ───────────────────────────────────────────────────────────────

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS expires_at DATE,        -- alias for expiry_date
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS asset_id UUID,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Sync existing expiry_date → expires_at
UPDATE documents SET expires_at = expiry_date WHERE expiry_date IS NOT NULL AND expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_expires_at
  ON documents (expires_at) WHERE expires_at IS NOT NULL;
