-- Migration: Social v2 - Relationships and Kanban
-- Add foreign keys and engagement metrics to posts

BEGIN;

-- Add relationship columns to social_posts
ALTER TABLE social_posts 
  ADD COLUMN IF NOT EXISTS objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE SET NULL;

-- Add scheduling and engagement columns
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS engagement_likes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_comments INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_shares INTEGER DEFAULT 0;

-- Add index for faster status queries
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);

-- Add index for objective linking
CREATE INDEX IF NOT EXISTS idx_social_posts_objective ON social_posts(objective_id);

-- Add index for person linking
CREATE INDEX IF NOT EXISTS idx_social_posts_person ON social_posts(person_id);

COMMIT;
