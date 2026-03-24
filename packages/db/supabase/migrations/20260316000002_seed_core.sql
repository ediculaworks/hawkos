-- =============================================================================
-- Migration 0002: Seed Core
-- Dados iniciais: perfil do usuário + 16 módulos registrados
-- =============================================================================

BEGIN;

-- Perfil do usuário (atualize com seus dados)
INSERT INTO profile (name, birth_date, metadata)
VALUES (
  'User',
  '2000-01-01',
  '{
    "checkin_morning": "09:00",
    "checkin_evening": "22:00",
    "weekly_review_day": "sunday",
    "weekly_review_time": "20:00",
    "timezone": "America/Sao_Paulo"
  }'
)
ON CONFLICT DO NOTHING;

-- 16 módulos (desabilitados por padrão, habilitados conforme fases)
INSERT INTO modules (id, enabled) VALUES
  ('finances',      false),
  ('health',        false),
  ('people',        false),
  ('career',        false),
  ('objectives',    false),
  ('knowledge',     false),
  ('routine',       false),
  ('assets',        false),
  ('entertainment', false),
  ('legal',         false),
  ('social',        false),
  ('spirituality',  false),
  ('housing',       false),
  ('security',      false),
  ('calendar',      false),
  ('journal',       false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
