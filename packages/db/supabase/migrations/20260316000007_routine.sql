-- Migration: Habits / Routine
-- Módulo: routine

CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly_2x', 'weekly_3x', 'weekdays')),
  target_days INTEGER,
  module TEXT,
  icon TEXT,
  active BOOLEAN DEFAULT true,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  total_completions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(habit_id, date)
);

-- Índices para queries frequentes
CREATE INDEX idx_habit_logs_habit_date ON habit_logs(habit_id, date DESC);
CREATE INDEX idx_habit_logs_date ON habit_logs(date DESC);
CREATE INDEX idx_habits_active ON habits(active) WHERE active = true;

-- Função para recalcular streak de um hábito
CREATE OR REPLACE FUNCTION update_habit_streak(habit_uuid UUID)
RETURNS void AS $$
DECLARE
  v_current_streak INTEGER := 0;
  v_best_streak INTEGER := 0;
  check_date DATE := CURRENT_DATE;
BEGIN
  -- Contar streak atual (dias consecutivos pra trás)
  WHILE EXISTS (
    SELECT 1 FROM habit_logs
    WHERE habit_id = habit_uuid
      AND date = check_date
      AND completed = true
  ) LOOP
    v_current_streak := v_current_streak + 1;
    check_date := check_date - 1;
  END LOOP;

  -- Buscar melhor streak já registrado
  SELECT best_streak INTO v_best_streak FROM habits WHERE id = habit_uuid;

  -- Atualizar hábito
  UPDATE habits
  SET
    current_streak = v_current_streak,
    best_streak = GREATEST(v_best_streak, v_current_streak),
    total_completions = (
      SELECT COUNT(*) FROM habit_logs
      WHERE habit_id = habit_uuid AND completed = true
    )
  WHERE id = habit_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger: recalcular streak após cada log inserido/atualizado
CREATE OR REPLACE FUNCTION trigger_update_habit_streak()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_habit_streak(NEW.habit_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER habit_log_streak_update
  AFTER INSERT OR UPDATE ON habit_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_habit_streak();
