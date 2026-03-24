-- Migration: Spirituality / Espiritualidade
-- Reflexões, gratidão, valores e propósito

CREATE TABLE IF NOT EXISTS reflections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL DEFAULT 'reflection' CHECK (type IN ('reflection', 'gratitude', 'intention', 'values', 'mantra')),
  content    TEXT NOT NULL,
  mood       SMALLINT CHECK (mood BETWEEN 1 AND 5),  -- estado ao escrever
  tags       TEXT[] NOT NULL DEFAULT '{}',
  logged_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full-text search em reflexões (português)
ALTER TABLE reflections ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

CREATE INDEX IF NOT EXISTS reflections_fts_idx ON reflections USING GIN (search_vector);

CREATE OR REPLACE FUNCTION reflections_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reflections_search_vector_trigger ON reflections;
CREATE TRIGGER reflections_search_vector_trigger
  BEFORE INSERT OR UPDATE ON reflections
  FOR EACH ROW EXECUTE FUNCTION reflections_search_vector_update();
CREATE INDEX IF NOT EXISTS reflections_type_idx ON reflections (type);
CREATE INDEX IF NOT EXISTS reflections_logged_at_idx ON reflections (logged_at DESC);

-- Valores pessoais (lista fixa, mas editável)
CREATE TABLE IF NOT EXISTS personal_values (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  priority    SMALLINT NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
