-- Generalize tenant settings - remove Hawk-specific defaults
BEGIN;

-- Add configurable fields to agent_settings
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS tenant_name TEXT NOT NULL DEFAULT 'My Agent';
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'pt-BR';
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS checkin_morning_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS checkin_morning_time TIME NOT NULL DEFAULT '09:00';
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS checkin_evening_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS checkin_evening_time TIME NOT NULL DEFAULT '22:00';
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS weekly_review_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS weekly_review_time TIME NOT NULL DEFAULT '20:00';
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS alerts_time TIME NOT NULL DEFAULT '08:00';
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS security_review_day INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS security_review_time TIME NOT NULL DEFAULT '10:00';
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS big_purchase_threshold DECIMAL(12,2) NOT NULL DEFAULT 500.00;

-- Update default agent name
UPDATE agent_settings SET agent_name = 'Hawk', tenant_name = 'My Agent' WHERE id = 'singleton';

-- Update automation_configs to be configurable per tenant
UPDATE automation_configs SET 
  description = REPLACE(description, 'Enviado às 09:00', 'Horário configurável') 
  WHERE id = 'daily-checkin-morning';
  
UPDATE automation_configs SET 
  description = REPLACE(description, 'Enviado às 22:00', 'Horário configurável') 
  WHERE id = 'daily-checkin-evening';
  
UPDATE automation_configs SET 
  description = REPLACE(description, 'Resumo semanal', 'Resumo semanal - horário configurável') 
  WHERE id = 'weekly-review';
  
UPDATE automation_configs SET 
  description = REPLACE(description, 'Aniversários, obrigações, contatos', 'Horário configurável') 
  WHERE id = 'alerts-daily';
  
UPDATE automation_configs SET 
  description = REPLACE(description, 'Revisão mensal de segurança', 'Horário configurável') 
  WHERE id = 'alerts-monthly';

-- Add cron expression override column (NULL means use default from agent_settings)
ALTER TABLE automation_configs ADD COLUMN IF NOT EXISTS cron_override TEXT;

-- Update RLS policies for new columns
DROP POLICY IF EXISTS "Allow authenticated read access" ON agent_settings;
CREATE POLICY "Allow authenticated read access"
  ON agent_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service role write access" ON agent_settings;
CREATE POLICY "Allow service role write access"
  ON agent_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
