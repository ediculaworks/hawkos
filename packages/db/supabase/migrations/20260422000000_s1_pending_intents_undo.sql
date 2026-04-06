-- Migration: S1 — Prerequisite Guard + Pending Intents + Undo Actions
-- Sprint 1 do SPRINT-ROADMAP.md

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: pending_intents (S1.1 — Prerequisite Guard)
-- Armazena intenções que não puderam ser executadas por falta de pré-requisito.
-- Cada registo vive no schema do tenant (isolamento garantido por search_path).
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pending_intents (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_json          JSONB       NOT NULL,
  -- ex: { "tool": "create_transaction", "args": { "amount": 1000, ... } }
  prerequisite         TEXT        NOT NULL,
  -- ex: "finances.accounts.exists"
  prerequisite_message TEXT        NOT NULL DEFAULT '',
  -- mensagem amigável do que falta (ex: "Cria uma conta bancária primeiro")
  description          TEXT        NOT NULL DEFAULT '',
  -- resumo legível da acção pendente (ex: "Registar receita de R$ 1000")
  status               TEXT        NOT NULL DEFAULT 'pending',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at          TIMESTAMPTZ,
  CONSTRAINT pending_intents_status_check CHECK (status IN ('pending', 'resolved', 'expired'))
);

CREATE INDEX idx_pending_intents_pending
  ON pending_intents(prerequisite)
  WHERE status = 'pending';

ALTER TABLE pending_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_pending_intents"
  ON pending_intents FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "service_all_pending_intents"
  ON pending_intents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- COLUMN: deleted_at — soft-delete para Undo Actions (S1.3)
-- Adicionado a finance_transactions, sleep_sessions, workout_sessions.
-- Queries de listagem devem filtrar WHERE deleted_at IS NULL.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE finance_transactions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_transactions_active
  ON finance_transactions(created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE sleep_sessions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sleep_sessions_active
  ON sleep_sessions(date DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_active
  ON workout_sessions(date DESC)
  WHERE deleted_at IS NULL;

COMMIT;
