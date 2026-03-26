-- Add per-tenant salt for AES key derivation.
-- NULL = use legacy static salt (backward compat for existing tenants).
-- New tenants get a random 64-char hex salt at creation time.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS key_salt TEXT;

COMMENT ON COLUMN tenants.key_salt IS 'Per-tenant random salt for AES-256-GCM key derivation. NULL = legacy static salt.';
