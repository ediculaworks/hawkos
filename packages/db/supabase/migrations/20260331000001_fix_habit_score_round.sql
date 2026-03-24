-- Fix: ROUND(double precision, integer) does not exist in PostgreSQL
-- Must cast to NUMERIC before calling ROUND with precision argument

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

  v_expected := CASE v_frequency
    WHEN 'daily'      THEN 30
    WHEN 'weekly_2x'  THEN 8
    WHEN 'weekly_3x'  THEN 12
    WHEN 'weekdays'   THEN 22
    ELSE 30
  END;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE completed = true)
  INTO v_total_logs, v_completed_logs
  FROM habit_logs
  WHERE habit_id = p_habit_id
    AND date >= CURRENT_DATE - 30;

  v_score := LEAST(100, ROUND((v_completed_logs::NUMERIC / GREATEST(v_expected, 1)) * 100));

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
    'completion_rate', ROUND((v_completed_logs::NUMERIC / GREATEST(v_expected, 1)) * 100, 1),
    'trend', v_trend
  );
END;
$$ LANGUAGE plpgsql;
