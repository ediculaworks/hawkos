-- Migration 31: Health - Exercises Library + Workout Templates
-- Objetivo: Permitir criar e gerenciar fichas de academia completas
--seed Exercícios: ~30 exercícios básicos seedados
--seed Templates: Push, Pull, Legs, Full Body

BEGIN;

-- Biblioteca de exercícios
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL CHECK (muscle_group IN (
    'peito', 'costas', 'perna', 'ombro', 'biceps', 'triceps', 'core', 'cardio', 'outro'
  )),
  secondary_muscles TEXT[] DEFAULT '{}',
  equipment TEXT[] DEFAULT '{}',
  exercise_type TEXT NOT NULL CHECK (exercise_type IN ('compound', 'isolation', 'cardio')),
  instructions TEXT,
  video_url TEXT,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exercises_muscle ON exercises(muscle_group);
CREATE INDEX idx_exercises_name ON exercises(name);
CREATE INDEX idx_exercises_type ON exercises(exercise_type);

-- Templates de treino (fichas)
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT,
  estimated_duration_m INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workout_templates_active ON workout_templates(is_active) WHERE is_active = true;

-- Séries do template
CREATE TABLE workout_template_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_order INTEGER NOT NULL DEFAULT 1,
  target_sets INTEGER NOT NULL DEFAULT 3,
  target_reps TEXT NOT NULL,
  target_weight_kg DECIMAL(6,2),
  rest_seconds INTEGER DEFAULT 90,
  notes TEXT
);

CREATE INDEX idx_template_sets_template ON workout_template_sets(template_id);
CREATE INDEX idx_template_sets_exercise ON workout_template_sets(exercise_id);

-- Trigger para updated_at em workout_templates
CREATE OR REPLACE FUNCTION update_workout_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workout_template_updated
  BEFORE UPDATE ON workout_templates
  FOR EACH ROW EXECUTE FUNCTION update_workout_template_timestamp();

-- RLS
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON exercises FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON workout_templates FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON workout_template_sets FOR ALL TO authenticated USING (true);

-- Seed: Exercícios básicos
INSERT INTO exercises (name, muscle_group, equipment, exercise_type) VALUES
  -- Peito
  ('Supino Reto', 'peito', ARRAY['barra', 'halteres'], 'compound'),
  ('Supino Inclinado', 'peito', ARRAY['barra', 'halteres'], 'compound'),
  ('Peck Deck', 'peito', ARRAY['maquina'], 'isolation'),
  ('Crucifixo', 'peito', ARRAY['halteres'], 'isolation'),
  ('Flexão de Braço', 'peito', ARRAY['peso'], 'compound'),
  -- Costas
  ('Puxada Frontal', 'costas', ARRAY['maquina', 'cabo'], 'compound'),
  ('Remada Curvada', 'costas', ARRAY['barra'], 'compound'),
  ('Remada Unilateral', 'costas', ARRAY['halteres'], 'compound'),
  ('Puxada Atrás da Nuca', 'costas', ARRAY['maquina'], 'compound'),
  ('Barra Fixa', 'costas', ARRAY['peso'], 'compound'),
  ('Pullover', 'costas', ARRAY['halteres', 'maquina'], 'isolation'),
  -- Pernas
  ('Agachamento', 'perna', ARRAY['barra'], 'compound'),
  ('Leg Press', 'perna', ARRAY['maquina'], 'compound'),
  ('Cadeira Extensora', 'perna', ARRAY['maquina'], 'isolation'),
  ('Cadeira Flexora', 'perna', ARRAY['maquina'], 'isolation'),
  ('Stiff', 'perna', ARRAY['barra'], 'compound'),
  ('Panturrilha em Pé', 'perna', ARRAY['maquina'], 'isolation'),
  ('Agachamento Sumo', 'perna', ARRAY['halteres'], 'compound'),
  ('Afundo', 'perna', ARRAY['halteres'], 'isolation'),
  ('Elevação Pélvica', 'perna', ARRAY['peso'], 'isolation'),
  -- Ombro
  ('Desenvolvimento', 'ombro', ARRAY['barra', 'halteres'], 'compound'),
  ('Elevação Lateral', 'ombro', ARRAY['halteres'], 'isolation'),
  ('Elevação Frontal', 'ombro', ARRAY['halteres'], 'isolation'),
  ('Face Pull', 'ombro', ARRAY['cabo'], 'isolation'),
  ('Arnold Press', 'ombro', ARRAY['halteres'], 'compound'),
  ('Reverso Peck Deck', 'ombro', ARRAY['maquina'], 'isolation'),
  -- Biceps
  ('Rosca Direta', 'biceps', ARRAY['barra', 'halteres'], 'isolation'),
  ('Rosca Martelo', 'biceps', ARRAY['halteres'], 'isolation'),
  ('Rosca Alternada', 'biceps', ARRAY['halteres'], 'isolation'),
  ('Rosca 21', 'biceps', ARRAY['barra'], 'isolation'),
  -- Triceps
  ('Tríceps Pulley', 'triceps', ARRAY['cabo'], 'isolation'),
  ('Mergulho no Banco', 'triceps', ARRAY['peso'], 'compound'),
  ('Tríceps Testa', 'triceps', ARRAY['barra'], 'isolation'),
  ('Tríceps Kickback', 'triceps', ARRAY['halteres'], 'isolation'),
  ('Rosca Inversa', 'triceps', ARRAY['halteres'], 'isolation'),
  -- Core
  ('Prancha', 'core', ARRAY['peso'], 'isolation'),
  ('Crunch', 'core', ARRAY['peso'], 'isolation'),
  ('Abdominal Infra', 'core', ARRAY['peso'], 'isolation'),
  ('Perna de Abdominal', 'core', ARRAY['peso'], 'isolation'),
  ('Russian Twist', 'core', ARRAY['peso'], 'isolation'),
  ('Leg Raise', 'core', ARRAY['peso'], 'isolation');

-- Seed: Templates básicos
INSERT INTO workout_templates (name, description, frequency, estimated_duration_m) VALUES
  ('A - Push (Peito/Ombro/Tri)', 'Dia de empurrar - peito, ombro e tríceps', '3x/semana', 60),
  ('B - Pull (Costas/Bíceps)', 'Dia de puxar - costas e bíceps', '3x/semana', 60),
  ('C - Legs (Perna)', 'Dia de pernas - quadríceps, posterior, panturrilha', '3x/semana', 50),
  ('Full Body', 'Corpo completo em uma sessão', '2x/semana', 75);

-- Seed: Séries do template A (Push)
INSERT INTO workout_template_sets (template_id, exercise_id, set_order, target_sets, target_reps, rest_seconds)
SELECT 
  wt.id,
  e.id,
  ROW_NUMBER() OVER (PARTITION BY wt.id ORDER BY e.muscle_group),
  3,
  '8-12',
  90
FROM workout_templates wt
CROSS JOIN exercises e
WHERE wt.name = 'A - Push (Peito/Ombro/Tri)'
AND e.muscle_group IN ('peito', 'ombro', 'triceps');

-- Seed: Séries do template B (Pull)
INSERT INTO workout_template_sets (template_id, exercise_id, set_order, target_sets, target_reps, rest_seconds)
SELECT 
  wt.id,
  e.id,
  ROW_NUMBER() OVER (PARTITION BY wt.id ORDER BY e.muscle_group),
  3,
  '8-12',
  90
FROM workout_templates wt
CROSS JOIN exercises e
WHERE wt.name = 'B - Pull (Costas/Bíceps)'
AND e.muscle_group IN ('costas', 'biceps');

-- Seed: Séries do template C (Legs)
INSERT INTO workout_template_sets (template_id, exercise_id, set_order, target_sets, target_reps, rest_seconds)
SELECT 
  wt.id,
  e.id,
  ROW_NUMBER() OVER (PARTITION BY wt.id ORDER BY e.muscle_group),
  3,
  '10-15',
  90
FROM workout_templates wt
CROSS JOIN exercises e
WHERE wt.name = 'C - Legs (Perna)'
AND e.muscle_group = 'perna';

-- Seed: Séries do template Full Body
INSERT INTO workout_template_sets (template_id, exercise_id, set_order, target_sets, target_reps, rest_seconds)
SELECT 
  wt.id,
  e.id,
  ROW_NUMBER() OVER (PARTITION BY wt.id ORDER BY e.muscle_group),
  3,
  '8-12',
  90
FROM workout_templates wt
CROSS JOIN exercises e
WHERE wt.name = 'Full Body'
AND e.muscle_group IN ('peito', 'costas', 'perna', 'ombro', 'biceps', 'triceps')
LIMIT 12;

COMMIT;
