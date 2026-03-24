-- Migration: Objectives + Tasks
-- Módulo: objectives

CREATE TABLE objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('short', 'medium', 'long')),
  module TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  target_date DATE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  parent_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  module TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para queries frequentes
CREATE INDEX idx_objectives_status ON objectives(status) WHERE status = 'active';
CREATE INDEX idx_objectives_timeframe ON objectives(timeframe);
CREATE INDEX idx_objectives_priority ON objectives(priority DESC);
CREATE INDEX idx_tasks_status ON tasks(status) WHERE status IN ('todo', 'in_progress', 'blocked');
CREATE INDEX idx_tasks_objective ON tasks(objective_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;

-- Trigger updated_at para objectives
CREATE OR REPLACE FUNCTION set_objectives_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER objectives_updated_at
  BEFORE UPDATE ON objectives
  FOR EACH ROW
  EXECUTE FUNCTION set_objectives_updated_at();
