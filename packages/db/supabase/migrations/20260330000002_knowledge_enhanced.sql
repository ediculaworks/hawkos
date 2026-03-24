-- Migration: Knowledge — Schema Ampliado + Collections + Backlinks
-- Referências: docs/repositorios/hoarder.md, docs/repositorios/memos.md
-- Tasks: I1.3.1–5

BEGIN;

-- ============================================================
-- BOOKMARKS / LINKS AMPLIADOS (Hoarder pattern)
-- ============================================================

-- Adicionar colunas a knowledge_notes para suportar bookmarks ricos
ALTER TABLE knowledge_notes
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,                   -- resumo gerado por LLM
  ADD COLUMN IF NOT EXISTS reading_time_minutes INT,
  ADD COLUMN IF NOT EXISTS word_count INT,
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_tagged BOOLEAN DEFAULT false,  -- foi processado pelo LLM
  ADD COLUMN IF NOT EXISTS checksum TEXT,                  -- SHA256 para dedup
  ADD COLUMN IF NOT EXISTS author TEXT,
  ADD COLUMN IF NOT EXISTS published_at DATE;

-- Índices para novos campos
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_url ON knowledge_notes(url) WHERE url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_starred ON knowledge_notes(is_starred) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_unread ON knowledge_notes(is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_checksum ON knowledge_notes(checksum) WHERE checksum IS NOT NULL;

-- Melhorar FTS para cobrir summary e author também
DROP INDEX IF EXISTS knowledge_notes_fts_idx;
CREATE INDEX knowledge_notes_fts_idx ON knowledge_notes
  USING gin(to_tsvector('portuguese',
    coalesce(title, '') || ' ' ||
    coalesce(content, '') || ' ' ||
    coalesce(summary, '') || ' ' ||
    coalesce(author, '')
  ));

-- ============================================================
-- COLLECTIONS (Hoarder pattern)
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES knowledge_collections(id) ON DELETE SET NULL,
  color TEXT,
  icon TEXT,
  is_public BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_collections_parent ON knowledge_collections(parent_id);

ALTER TABLE knowledge_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage collections" ON knowledge_collections FOR ALL USING (true) WITH CHECK (true);

-- M2M: nota pode estar em múltiplas coleções
CREATE TABLE IF NOT EXISTS knowledge_note_collections (
  note_id UUID NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (note_id, collection_id)
);

ALTER TABLE knowledge_note_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage note collections" ON knowledge_note_collections FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- BACKLINKS / NOTE RELATIONS (Memos pattern)
-- ============================================================

CREATE TABLE IF NOT EXISTS note_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('knowledge', 'journal', 'book')),
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('knowledge', 'journal', 'book')),
  relation_type TEXT DEFAULT 'reference' CHECK (relation_type IN ('reference', 'continuation', 'contradiction', 'supports', 'inspired_by')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, target_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_note_relations_source ON note_relations(source_id, source_type);
CREATE INDEX IF NOT EXISTS idx_note_relations_target ON note_relations(target_id, target_type);  -- para backlinks

ALTER TABLE note_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage note relations" ON note_relations FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PROCESSING QUEUE (para OCR/summarize assíncrono)
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  tasks TEXT[] NOT NULL DEFAULT '{}',  -- ['summarize', 'auto_tag', 'screenshot']
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts INT DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_knowledge_queue_pending ON knowledge_processing_queue(status, created_at) WHERE status = 'pending';

ALTER TABLE knowledge_processing_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage processing queue" ON knowledge_processing_queue FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at em collections
CREATE OR REPLACE FUNCTION update_knowledge_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_collections_updated_at
  BEFORE UPDATE ON knowledge_collections
  FOR EACH ROW EXECUTE FUNCTION update_knowledge_collections_updated_at();

COMMIT;
