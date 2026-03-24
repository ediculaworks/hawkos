-- Migration: Knowledge / Second Brain
-- Módulo: knowledge

CREATE TABLE knowledge_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('note', 'insight', 'reference', 'book_note', 'quote')),
  source TEXT,                   -- livro, artigo, podcast, URL, etc.
  tags TEXT[] DEFAULT '{}',
  module TEXT,                   -- módulo relacionado
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT,
  status TEXT NOT NULL DEFAULT 'want_to_read' CHECK (status IN ('want_to_read', 'reading', 'completed', 'abandoned')),
  started_at DATE,
  finished_at DATE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  notes TEXT,
  key_insights TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_knowledge_notes_type ON knowledge_notes(type);
CREATE INDEX idx_knowledge_notes_tags ON knowledge_notes USING gin(tags);
CREATE INDEX idx_knowledge_notes_created ON knowledge_notes(created_at DESC);
CREATE INDEX idx_books_status ON books(status);

-- Full-text search em português
CREATE INDEX knowledge_notes_fts_idx
ON knowledge_notes USING gin(
  to_tsvector('portuguese', coalesce(title, '') || ' ' || content)
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_notes_updated_at
  BEFORE UPDATE ON knowledge_notes
  FOR EACH ROW
  EXECUTE FUNCTION set_knowledge_updated_at();
