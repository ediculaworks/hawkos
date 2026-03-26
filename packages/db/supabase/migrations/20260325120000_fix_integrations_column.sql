-- Fix tenant_integrations.config_encrypted column type
-- Was JSONB (for plain config), now TEXT (for AES-256-GCM base64 ciphertext)
BEGIN;

ALTER TABLE tenant_integrations
  ALTER COLUMN config_encrypted TYPE TEXT USING config_encrypted::TEXT,
  ALTER COLUMN config_encrypted DROP DEFAULT,
  ALTER COLUMN config_encrypted DROP NOT NULL;

COMMENT ON COLUMN tenant_integrations.config_encrypted IS 'AES-256-GCM encrypted config as base64 string';
COMMENT ON COLUMN tenant_integrations.config_iv IS 'Initialization vector for AES-256-GCM decryption (base64)';

COMMIT;
