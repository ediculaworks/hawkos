-- Phase 2: Atomic task checkout (Paperclip) + Memory confidence (DeerFlow) + Per-tenant budget
-- Migration: 20260417000000

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 2.1 Atomic Task Checkout for Demand Steps (Paperclip pattern)
-- ═══════════════════════════════════════════════════════════════════════

-- Add checkout fields to demand_steps
ALTER TABLE demand_steps
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by TEXT,
  ADD COLUMN IF NOT EXISTS max_claim_duration_seconds INTEGER DEFAULT 600;

-- Index for finding stale claims efficiently
CREATE INDEX IF NOT EXISTS idx_demand_steps_claimed_at
  ON demand_steps (claimed_at) WHERE claimed_at IS NOT NULL AND status = 'running';

-- Function: atomically checkout a step (returns the step or NULL if already claimed)
CREATE OR REPLACE FUNCTION checkout_demand_step(p_step_id UUID, p_claimed_by TEXT)
RETURNS SETOF demand_steps
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE demand_steps
  SET
    status = 'running',
    claimed_at = NOW(),
    claimed_by = p_claimed_by,
    started_at = COALESCE(started_at, NOW())
  WHERE id = p_step_id
    AND status = 'ready'
    AND claimed_at IS NULL
  RETURNING *;
END;
$$;

-- Function: recover stale claims (steps claimed but not completed within timeout)
CREATE OR REPLACE FUNCTION recover_stale_demand_steps()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  recovered INTEGER;
BEGIN
  UPDATE demand_steps
  SET
    status = 'ready',
    claimed_at = NULL,
    claimed_by = NULL,
    retry_count = retry_count + 1
  WHERE status = 'running'
    AND claimed_at IS NOT NULL
    AND claimed_at < NOW() - (max_claim_duration_seconds || ' seconds')::INTERVAL
    AND retry_count < max_retries;

  GET DIAGNOSTICS recovered = ROW_COUNT;

  -- Mark as failed if exceeded max retries
  UPDATE demand_steps
  SET
    status = 'failed',
    error_message = 'Exceeded max retries after stale claim recovery'
  WHERE status = 'running'
    AND claimed_at IS NOT NULL
    AND claimed_at < NOW() - (max_claim_duration_seconds || ' seconds')::INTERVAL
    AND retry_count >= max_retries;

  RETURN recovered;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2.2 Memory Confidence Scores (DeerFlow pattern)
-- ═══════════════════════════════════════════════════════════════════════

-- Add confidence field to agent_memories
ALTER TABLE agent_memories
  ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0.8;

-- Constraint: confidence must be between 0 and 1
ALTER TABLE agent_memories
  ADD CONSTRAINT chk_confidence_range CHECK (confidence >= 0.0 AND confidence <= 1.0);

-- Index for weighted retrieval (confidence * similarity)
CREATE INDEX IF NOT EXISTS idx_memories_confidence
  ON agent_memories (confidence) WHERE status = 'active';

-- ═══════════════════════════════════════════════════════════════════════
-- 2.3 Per-Tenant Budget (Paperclip pattern)
-- ═══════════════════════════════════════════════════════════════════════

-- Add budget fields to tenants.feature_flags JSONB (no schema change needed,
-- just document the expected shape). The budget is read from:
-- tenants.feature_flags->>'daily_budget_usd'
--
-- No DDL needed — feature_flags is already JSONB on the tenants table.
-- The model-router will read this field at runtime.

COMMIT;
