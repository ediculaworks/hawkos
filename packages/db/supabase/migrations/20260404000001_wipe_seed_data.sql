-- =============================================================================
-- Migration 20260404000001: Wipe all pre-seeded content data
--
-- Removes data-only seed rows so new tenants start completely blank.
-- Does NOT touch DDL (tables, indexes, constraints stay intact).
-- =============================================================================

BEGIN;

-- Finance
DELETE FROM finance_categories;
DELETE FROM finance_accounts;
DELETE FROM calendar_sync_config;

-- Routine / Health
DELETE FROM habits;
DELETE FROM objectives;
DELETE FROM workout_template_sets;
DELETE FROM workout_templates;
DELETE FROM exercises;

-- Housing / Security
DELETE FROM housing_bills;
DELETE FROM residences;
DELETE FROM security_items;

-- Personal / Entertainment
DELETE FROM personal_values;
DELETE FROM media_items;

-- Onboarding questions (shown during setup wizard — tenant fills in their own answers)
DELETE FROM onboarding_questions;

-- Agent templates: remove all specialist / user-facing agents except Hawk (001)
-- Manter: Hawk (000...001) + workers (000...0020 a 000...0023)
DELETE FROM agent_templates
WHERE id IN (
  '00000000-0000-0000-0000-000000000010', -- CFO / Bull
  '00000000-0000-0000-0000-000000000011', -- Coach / Wolf
  '00000000-0000-0000-0000-000000000012', -- Career Coach / Owl (if exists)
  '00000000-0000-0000-0000-000000000013', -- Chief of Staff / Bee
  '00000000-0000-0000-0000-000000000014', -- House Manager / Beaver
  '00000000-0000-0000-0000-000000000015', -- Creative Director / Fox
  '00000000-0000-0000-0000-000000000016'  -- Artist / Peacock
);

-- Hawk: remove hardcoded llm_model so smart routing (MODEL_TIER_* env vars) is used
-- When llm_model is NULL, selectModel() falls back to openrouter/auto
UPDATE agent_templates
SET llm_model = NULL
WHERE id = '00000000-0000-0000-0000-000000000001';

COMMIT;
