-- Migration: Entertainment
-- Filmes, séries, músicas, hobbies e lazer

CREATE TABLE IF NOT EXISTS media_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('movie', 'series', 'book_fiction', 'game', 'podcast', 'music_album', 'outros')),
  status      TEXT NOT NULL DEFAULT 'want' CHECK (status IN ('want', 'watching', 'completed', 'abandoned')),
  rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
  platform    TEXT,                -- Netflix, Spotify, etc.
  genre       TEXT,
  notes       TEXT,
  started_at  DATE,
  finished_at DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hobby_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity    TEXT NOT NULL,       -- ex: "skate", "violão", "desenho"
  duration_min INTEGER,            -- duração em minutos
  notes       TEXT,
  logged_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_items_status_idx ON media_items (status);
CREATE INDEX IF NOT EXISTS media_items_type_idx ON media_items (type);
CREATE INDEX IF NOT EXISTS hobby_logs_activity_idx ON hobby_logs (activity);
CREATE INDEX IF NOT EXISTS hobby_logs_logged_at_idx ON hobby_logs (logged_at DESC);
