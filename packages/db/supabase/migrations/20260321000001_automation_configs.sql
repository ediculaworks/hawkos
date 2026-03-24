-- Automation Configs: configurações de automations
BEGIN;

CREATE TABLE IF NOT EXISTS automation_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  cron_expression TEXT NOT NULL,
  last_run TIMESTAMPTZ,
  last_status TEXT CHECK (last_status IN ('success', 'failure', NULL)),
  run_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE automation_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON automation_configs;
CREATE POLICY "Allow public read access"
  ON automation_configs FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service role write access" ON automation_configs;
CREATE POLICY "Allow service role write access"
  ON automation_configs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed default automations
INSERT INTO automation_configs (id, name, description, enabled, cron_expression) VALUES
  ('daily-checkin-morning', 'Check-in Matinal', 'Enviado às 09:00 - humor, energia, top 3', true, '0 9 * * *'),
  ('daily-checkin-evening', 'Check-in Noturno', 'Enviado às 22:00 - hábitos do dia, reflexão', true, '0 22 * * *'),
  ('weekly-review', 'Weekly Review', 'Resumo semanal - hábitos, humor, metas', true, '0 20 * * 0'),
  ('alerts-daily', 'Alertas Diários', 'Aniversários, obrigações, contatos', true, '0 8 * * *'),
  ('alerts-monthly', 'Security Review', 'Revisão mensal de segurança', true, '0 10 1 * *'),
  ('health-insights', 'Health Insights', 'Análise de dados de saúde', true, '0 9 * * *'),
  ('content-pipeline', 'Content Pipeline', 'Review de pipeline de conteúdo', true, '0 17 * * 5'),
  ('session-compactor', 'Session Compactor', 'Compação de sessões a cada hora', true, '0 * * * *')
ON CONFLICT (id) DO NOTHING;

COMMIT;
