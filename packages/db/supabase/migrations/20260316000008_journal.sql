-- Migration: Journal / Diário
-- Módulo: journal

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'daily' CHECK (type IN ('daily', 'reflection', 'gratitude', 'freeform', 'weekly_review')),
  content TEXT NOT NULL,
  mood INTEGER CHECK (mood BETWEEN 1 AND 10),
  energy INTEGER CHECK (energy BETWEEN 1 AND 10),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',  -- highlight_of_day, challenge_of_day, top3, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, type)
);

-- Índices para queries frequentes
CREATE INDEX idx_journal_entries_date ON journal_entries(date DESC);
CREATE INDEX idx_journal_entries_type ON journal_entries(type);
CREATE INDEX idx_journal_entries_mood ON journal_entries(mood) WHERE mood IS NOT NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_journal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_journal_updated_at();
