-- Migration: Social
-- Presença digital, posts, metas de conteúdo e rede

CREATE TABLE IF NOT EXISTS social_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform     TEXT NOT NULL CHECK (platform IN ('instagram', 'linkedin', 'twitter', 'youtube', 'tiktok', 'outros')),
  content      TEXT,               -- rascunho ou descrição do post
  status       TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'draft', 'scheduled', 'published')),
  published_at TIMESTAMPTZ,
  url          TEXT,               -- link do post publicado
  tags         TEXT[] NOT NULL DEFAULT '{}',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    TEXT NOT NULL,
  metric      TEXT NOT NULL,       -- ex: "followers", "posts_per_week"
  target      INTEGER NOT NULL,
  current     INTEGER NOT NULL DEFAULT 0,
  period      TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'yearly')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_posts_platform_idx ON social_posts (platform);
CREATE INDEX IF NOT EXISTS social_posts_status_idx ON social_posts (status);
