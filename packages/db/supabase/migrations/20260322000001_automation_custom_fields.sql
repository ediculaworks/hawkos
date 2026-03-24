-- Add custom and category fields to automation_configs for custom automations
BEGIN;

ALTER TABLE automation_configs
  ADD COLUMN IF NOT EXISTS custom BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'custom';

-- Set categories for existing seeded automations
UPDATE automation_configs SET category = 'checkin' WHERE id IN ('daily-checkin-morning', 'daily-checkin-evening');
UPDATE automation_configs SET category = 'review' WHERE id = 'weekly-review';
UPDATE automation_configs SET category = 'alerts' WHERE id IN ('alerts-daily', 'alerts-monthly');
UPDATE automation_configs SET category = 'health' WHERE id = 'health-insights';
UPDATE automation_configs SET category = 'content' WHERE id = 'content-pipeline';
UPDATE automation_configs SET category = 'system' WHERE id IN ('session-compactor', 'heartbeat');

COMMIT;
