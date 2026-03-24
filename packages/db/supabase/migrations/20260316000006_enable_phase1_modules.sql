-- =============================================================================
-- Migration 0006: Enable Phase 1 Modules
-- Habilitar módulos Finances e Calendar para o início da Fase 1
-- =============================================================================

BEGIN;

UPDATE modules SET enabled = true WHERE id IN ('finances', 'calendar');

COMMIT;
