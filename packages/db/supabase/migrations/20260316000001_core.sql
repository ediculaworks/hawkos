-- =============================================================================
-- Migration 0001: Schema Core
-- Tabelas compartilhadas entre todos os módulos
-- =============================================================================

BEGIN;

-- Perfil do usuário (single-tenant)
CREATE TABLE IF NOT EXISTS profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  birth_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Registry de módulos ativos
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tags universais (cross-module)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  color TEXT
);

-- Relação polimórfica: qualquer entidade pode ser taggeada
CREATE TABLE IF NOT EXISTS entity_tags (
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_updated_at
  BEFORE UPDATE ON profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;

-- Policies: apenas usuário autenticado
CREATE POLICY "auth_only" ON profile FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON modules FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON tags FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON entity_tags FOR ALL TO authenticated USING (true);

-- Service role bypassa RLS (para o agent server-side)
ALTER TABLE profile FORCE ROW LEVEL SECURITY;
ALTER TABLE modules FORCE ROW LEVEL SECURITY;

COMMIT;
