-- Migration: Routine — Habit Streak Enhancements
-- Referência: docs/repositorios/habitica.md
-- Tasks: I1.8.1–2

BEGIN;

-- ============================================================
-- ENHANCED HABITS (Habitica pattern)
-- ============================================================

-- Adicionar colunas de gamificação/scoring a habits
ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium'
    CHECK (difficulty IN ('trivial', 'easy', 'medium', 'hard')),
  ADD COLUMN IF NOT EXISTS is_positive BOOLEAN DEFAULT true,   -- false = hábito ruim (ex: fumar)
  ADD COLUMN IF NOT EXISTS streak_freeze_count INT DEFAULT 0,  -- dias de graça disponíveis
  ADD COLUMN IF NOT EXISTS last_completed_date DATE,
  ADD COLUMN IF NOT EXISTS positive_score FLOAT DEFAULT 1.0,   -- peso do impacto positivo
  ADD COLUMN IF NOT EXISTS negative_score FLOAT DEFAULT 1.0;   -- peso do impacto negativo

-- ============================================================
-- FUNÇÃO: update_habit_streak (chamada ao completar um hábito)
-- ============================================================

-- Drop old void-returning version to allow return type change to JSONB
DROP FUNCTION IF EXISTS update_habit_streak(UUID);

CREATE OR REPLACE FUNCTION update_habit_streak(p_habit_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_last_date DATE;
  v_current_streak INT;
  v_best_streak INT;
  v_freeze_count INT;
  v_result JSONB;
  v_today DATE := CURRENT_DATE;
BEGIN
  SELECT
    last_completed_date,
    current_streak,
    best_streak,
    COALESCE(streak_freeze_count, 0)
  INTO v_last_date, v_current_streak, v_best_streak, v_freeze_count
  FROM habits
  WHERE id = p_habit_id;

  IF v_last_date = v_today THEN
    -- Já completou hoje — idempotente
    v_result := jsonb_build_object(
      'action', 'already_completed',
      'streak', v_current_streak
    );
    RETURN v_result;
  END IF;

  IF v_last_date = v_today - 1 THEN
    -- Continuidade: incrementar streak
    v_current_streak := v_current_streak + 1;
    v_result := jsonb_build_object('action', 'continued', 'streak', v_current_streak);

  ELSIF v_last_date IS NULL OR v_last_date < v_today - 1 THEN
    -- Gap detectado
    DECLARE
      v_days_missed INT := (v_today - COALESCE(v_last_date, v_today - 1) - 1);
    BEGIN
      IF v_freeze_count > 0 AND v_days_missed <= v_freeze_count THEN
        -- Usar freeze para proteger o streak
        v_freeze_count := v_freeze_count - v_days_missed;
        v_current_streak := v_current_streak + 1;
        v_result := jsonb_build_object(
          'action', 'freeze_used',
          'streak', v_current_streak,
          'freezes_remaining', v_freeze_count
        );
      ELSE
        -- Streak quebrado — resetar
        v_current_streak := 1;
        v_result := jsonb_build_object('action', 'reset', 'streak', 1);
      END IF;
    END;
  END IF;

  -- Atualizar best_streak se necessário
  IF v_current_streak > v_best_streak THEN
    v_best_streak := v_current_streak;
  END IF;

  -- Persistir
  UPDATE habits SET
    current_streak = v_current_streak,
    best_streak = v_best_streak,
    last_completed_date = v_today,
    streak_freeze_count = v_freeze_count,
    total_completions = total_completions + 1
  WHERE id = p_habit_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNÇÃO: get_habit_score (score 0-100 baseado em 30 dias)
-- ============================================================

CREATE OR REPLACE FUNCTION get_habit_score(p_habit_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_logs INT;
  v_completed_logs INT;
  v_expected INT;
  v_frequency TEXT;
  v_score INT;
  v_trend TEXT;
  v_prev_score INT;
BEGIN
  SELECT frequency INTO v_frequency FROM habits WHERE id = p_habit_id;

  -- Calcular dias esperados nos últimos 30 dias
  v_expected := CASE v_frequency
    WHEN 'daily'      THEN 30
    WHEN 'weekly_2x'  THEN 8    -- ~2x por semana = ~8.5
    WHEN 'weekly_3x'  THEN 12   -- ~3x por semana = ~12.8
    WHEN 'weekdays'   THEN 22   -- ~22 dias úteis
    ELSE 30
  END;

  -- Logs dos últimos 30 dias
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE completed = true)
  INTO v_total_logs, v_completed_logs
  FROM habit_logs
  WHERE habit_id = p_habit_id
    AND date >= CURRENT_DATE - 30;

  -- Score: % de completude (capped 100)
  v_score := LEAST(100, ROUND((v_completed_logs::FLOAT / GREATEST(v_expected, 1)) * 100));

  -- Trend: comparar última semana vs semana anterior
  DECLARE
    v_last_week INT;
    v_prev_week INT;
  BEGIN
    SELECT COUNT(*) FILTER (WHERE completed = true) INTO v_last_week
    FROM habit_logs
    WHERE habit_id = p_habit_id AND date >= CURRENT_DATE - 7;

    SELECT COUNT(*) FILTER (WHERE completed = true) INTO v_prev_week
    FROM habit_logs
    WHERE habit_id = p_habit_id AND date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 8;

    v_trend := CASE
      WHEN v_last_week > v_prev_week THEN 'up'
      WHEN v_last_week < v_prev_week THEN 'down'
      ELSE 'stable'
    END;
  END;

  RETURN jsonb_build_object(
    'score', v_score,
    'completed_30d', v_completed_logs,
    'expected_30d', v_expected,
    'completion_rate', ROUND((v_completed_logs::FLOAT / GREATEST(v_expected, 1)) * 100, 1),
    'trend', v_trend
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNÇÃO: get_habits_at_risk (streaks prestes a quebrar hoje)
-- ============================================================

CREATE OR REPLACE FUNCTION get_habits_at_risk()
RETURNS TABLE(
  habit_id UUID,
  habit_name TEXT,
  current_streak INT,
  last_completed_date DATE,
  frequency TEXT,
  difficulty TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id,
    h.name,
    h.current_streak,
    h.last_completed_date,
    h.frequency,
    h.difficulty
  FROM habits h
  WHERE h.active = true
    AND h.is_positive = true
    AND h.current_streak > 0
    AND h.last_completed_date < CURRENT_DATE  -- não completou hoje
    AND (
      -- Daily: não completou ontem (streak quebra hoje)
      (h.frequency = 'daily' AND h.last_completed_date = CURRENT_DATE - 1)
      OR
      -- Outros: verificar se está em janela de risco
      (h.frequency != 'daily' AND h.last_completed_date >= CURRENT_DATE - 3)
    )
  ORDER BY h.current_streak DESC;
END;
$$ LANGUAGE plpgsql;

COMMIT;
