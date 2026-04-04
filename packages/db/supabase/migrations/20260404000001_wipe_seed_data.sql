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

-- Agent templates: keep only Hawk orchestrator + 4 workers.
-- Removes all specialist/user-facing agents (fixed IDs and any UUID-based duplicates).
DELETE FROM agent_templates
WHERE id NOT IN (
  '00000000-0000-0000-0000-000000000001', -- Hawk (orchestrator)
  '00000000-0000-0000-0000-000000000020', -- Memory Extractor (worker)
  '00000000-0000-0000-0000-000000000021', -- Title Generator (worker)
  '00000000-0000-0000-0000-000000000022', -- Insight Synthesizer (worker)
  '00000000-0000-0000-0000-000000000023'  -- Dedup Judge (worker)
);

-- Hawk: remove hardcoded llm_model so smart routing (MODEL_TIER_* env vars) is used
-- When llm_model is NULL, selectModel() falls back to openrouter/auto
UPDATE agent_templates
SET llm_model = NULL
WHERE id = '00000000-0000-0000-0000-000000000001';

COMMIT;
