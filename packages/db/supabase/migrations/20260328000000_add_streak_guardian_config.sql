-- Add streak-guardian to automation_configs
BEGIN;

INSERT INTO automation_configs (id, name, description, enabled, cron_expression) VALUES
  ('streak-guardian', 'Streak Guardian', 'Alerta diário às 20:00 sobre hábitos com streak em risco', true, '0 20 * * *')
ON CONFLICT (id) DO NOTHING;

COMMIT;
