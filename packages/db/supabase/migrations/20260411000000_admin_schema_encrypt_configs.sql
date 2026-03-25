-- Encrypt Discord and OpenRouter configs in tenants table
-- Previously stored as plain text JSONB, now encrypted with AES-256-GCM
BEGIN;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS discord_config_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS discord_config_iv TEXT,
  ADD COLUMN IF NOT EXISTS openrouter_config_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS openrouter_config_iv TEXT;

COMMENT ON COLUMN tenants.discord_config_encrypted IS 'AES-256-GCM encrypted Discord config (bot_token, guild_id, etc.)';
COMMENT ON COLUMN tenants.openrouter_config_encrypted IS 'AES-256-GCM encrypted OpenRouter config (api_key, model)';
COMMENT ON COLUMN tenants.discord_config IS 'Deprecated: replaced by discord_config_encrypted. Kept for backward compat with {_encrypted: true} marker.';
COMMENT ON COLUMN tenants.openrouter_config IS 'Deprecated: replaced by openrouter_config_encrypted. Kept for backward compat with {_encrypted: true} marker.';

COMMIT;
