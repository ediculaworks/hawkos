-- S5.2: Onboarding Sequence — track when onboarding completed
-- Adds onboarding_completed_at to profile so the 14-day nudge window can be calculated.

BEGIN;

ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Backfill: approximate completed_at for tenants that already finished onboarding
UPDATE profile
   SET onboarding_completed_at = now()
 WHERE onboarding_complete = true
   AND onboarding_completed_at IS NULL;

COMMIT;
