-- S5.4: Google Calendar Sync — add provider column for future multi-provider support.
-- calendar_sync_config already has: access_token, refresh_token, token_expiry,
-- google_calendar_id, metadata (used for sync_token). This migration is additive only.

BEGIN;

ALTER TABLE calendar_sync_config
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'google';

-- Index to quickly find active Google syncs
CREATE INDEX IF NOT EXISTS idx_calendar_sync_config_provider_enabled
  ON calendar_sync_config (provider, sync_enabled)
  WHERE sync_enabled = true;

COMMIT;
