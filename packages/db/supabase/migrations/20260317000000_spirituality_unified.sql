-- Migration: Unify spirituality mood scale to 1-10 (same as journal)
-- And add value_id to objectives for explicit value linking

BEGIN;

-- Change mood from 1-5 to 1-10 scale
ALTER TABLE reflections 
ALTER COLUMN mood TYPE SMALLINT USING (mood::SMALLINT),
ALTER COLUMN mood DROP DEFAULT;

-- Add explicit value linking to objectives (optional, for explicit mappings)
ALTER TABLE objectives 
ADD COLUMN IF NOT EXISTS value_id UUID REFERENCES personal_values(id) ON DELETE SET NULL;

-- Add unique constraint for value-objective mapping if needed
-- (one objective can be linked to one primary value)

COMMIT;
