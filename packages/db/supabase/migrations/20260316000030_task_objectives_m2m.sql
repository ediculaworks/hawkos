-- Task → Multiple Objectives (many-to-many junction table)
BEGIN;

CREATE TABLE task_objectives (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (task_id, objective_id)
);

CREATE INDEX idx_task_objectives_task ON task_objectives(task_id);
CREATE INDEX idx_task_objectives_obj ON task_objectives(objective_id);

ALTER TABLE task_objectives ENABLE ROW LEVEL SECURITY;

-- Migrate existing single FK data to junction table
INSERT INTO task_objectives (task_id, objective_id)
SELECT id, objective_id FROM tasks WHERE objective_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
