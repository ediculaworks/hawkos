-- Batch RPC: get_all_habit_scores
-- Returns scores for ALL active habits in one query (avoids N+1 from getWeeklyRoutineScore)
-- Uses the same scoring logic as get_habit_score but in a set-returning function.

BEGIN;

CREATE OR REPLACE FUNCTION get_all_habit_scores()
RETURNS TABLE(habit_id UUID, score INT, completed_30d INT, expected_30d INT, trend TEXT)
AS $$
BEGIN
  RETURN QUERY
  WITH habit_stats AS (
    SELECT
      h.id AS hid,
      h.frequency,
      COUNT(hl.*) AS total_logs,
      COUNT(hl.*) FILTER (WHERE hl.completed = true) AS completed_logs,
      CASE h.frequency
        WHEN 'daily'     THEN 30
        WHEN 'weekly_2x' THEN 8
        WHEN 'weekly_3x' THEN 12
        WHEN 'weekdays'  THEN 22
        ELSE 30
      END AS expected,
      COUNT(hl.*) FILTER (WHERE hl.completed = true AND hl.date >= CURRENT_DATE - 7) AS last_week,
      COUNT(hl.*) FILTER (WHERE hl.completed = true AND hl.date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 8) AS prev_week
    FROM habits h
    LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.date >= CURRENT_DATE - 30
    WHERE h.archived = false
    GROUP BY h.id, h.frequency
  )
  SELECT
    hs.hid AS habit_id,
    LEAST(100, ROUND((hs.completed_logs::NUMERIC / GREATEST(hs.expected, 1)) * 100))::INT AS score,
    hs.completed_logs::INT AS completed_30d,
    hs.expected::INT AS expected_30d,
    CASE
      WHEN hs.last_week > hs.prev_week THEN 'up'
      WHEN hs.last_week < hs.prev_week THEN 'down'
      ELSE 'stable'
    END AS trend
  FROM habit_stats hs;
END;
$$ LANGUAGE plpgsql;

COMMIT;
