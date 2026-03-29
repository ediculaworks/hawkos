BEGIN;

INSERT INTO automation_configs (id, name, description, enabled, cron_expression) VALUES
  ('memory-forgetter', 'Memory Forgetter', 'Auto-archive memorias antigas nao acessadas', true, '0 4 * * 0')
ON CONFLICT (id) DO NOTHING;

COMMIT;
