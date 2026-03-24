-- Fix is_system scope: only Hawk should be is_system = true
-- Specialists and workers become editable AND deletable by the user
BEGIN;

UPDATE agent_templates
SET is_system = false
WHERE id != '00000000-0000-0000-0000-000000000001'
  AND is_system = true;

COMMIT;
