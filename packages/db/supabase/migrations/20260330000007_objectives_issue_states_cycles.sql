-- Migration: Objectives — Issue States + Cycles + Sub-tasks
-- Referência: docs/repositorios/plane.md
-- Tasks: I1.5.1–5

BEGIN;

-- ============================================================
-- ISSUE STATES (Plane pattern)
-- Estados customizáveis por objetivo/projeto
-- ============================================================

CREATE TABLE IF NOT EXISTS issue_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID REFERENCES objectives(id) ON DELETE CASCADE,  -- NULL = global
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  type TEXT NOT NULL DEFAULT 'unstarted' CHECK (type IN (
    'backlog', 'unstarted', 'started', 'completed', 'cancelled'
  )),
  position FLOAT NOT NULL DEFAULT 0,      -- ordenação drag-and-drop
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_states_objective ON issue_states(objective_id);
CREATE INDEX IF NOT EXISTS idx_issue_states_position ON issue_states(objective_id, position);

ALTER TABLE issue_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage issue states" ON issue_states FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- TASKS ENHANCED (Plane pattern)
-- Adicionar campos que faltam para um sistema de tasks completo
-- ============================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES issue_states(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,  -- sub-tarefas
  ADD COLUMN IF NOT EXISTS assignee_people_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimate_points INT,            -- story points
  ADD COLUMN IF NOT EXISTS sequence_id SERIAL,             -- número legível: #1, #2, ...
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sort_order FLOAT,
  ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}',     -- etiquetas livres
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state_id) WHERE state_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_sequence ON tasks(sequence_id);

-- Trigger updated_at em tasks
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();

-- ============================================================
-- CYCLES / SPRINTS (Plane pattern)
-- ============================================================

CREATE TABLE IF NOT EXISTS cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID REFERENCES objectives(id) ON DELETE CASCADE,  -- NULL = ciclo pessoal global
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  retrospective_notes TEXT,
  velocity_estimate INT,           -- pontos planejados
  velocity_actual INT,             -- pontos concluídos (calculado ao fechar)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_cycle_dates CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_cycles_status ON cycles(status);
CREATE INDEX IF NOT EXISTS idx_cycles_active ON cycles(status, start_date, end_date)
  WHERE status = 'active';

ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage cycles" ON cycles FOR ALL USING (true) WITH CHECK (true);

-- M2M: tarefa pode estar em múltiplos ciclos
CREATE TABLE IF NOT EXISTS cycle_tasks (
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (cycle_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_cycle_tasks_cycle ON cycle_tasks(cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_tasks_task ON cycle_tasks(task_id);

ALTER TABLE cycle_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage cycle tasks" ON cycle_tasks FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- ISSUE LABELS (Plane pattern)
-- Etiquetas visuais por objetivo
-- ============================================================

CREATE TABLE IF NOT EXISTS issue_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID REFERENCES objectives(id) ON DELETE CASCADE,  -- NULL = global
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE issue_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage issue labels" ON issue_labels FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED: States padrão (globais, sem objective_id)
-- ============================================================

INSERT INTO issue_states (objective_id, name, color, type, position, is_default) VALUES
  (NULL, 'Backlog',      '#6b7280', 'backlog',   0,   false),
  (NULL, 'A fazer',      '#3b82f6', 'unstarted', 1,   true),
  (NULL, 'Em progresso', '#f59e0b', 'started',   2,   false),
  (NULL, 'Revisão',      '#8b5cf6', 'started',   3,   false),
  (NULL, 'Concluído',    '#10b981', 'completed', 4,   false),
  (NULL, 'Cancelado',    '#ef4444', 'cancelled', 5,   false)
ON CONFLICT DO NOTHING;

-- Trigger updated_at em cycles
CREATE TRIGGER cycles_updated_at
  BEFORE UPDATE ON cycles
  FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();

COMMIT;
