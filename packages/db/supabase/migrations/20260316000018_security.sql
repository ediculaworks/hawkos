-- Migration: Security / Segurança Digital
-- Módulo: security

CREATE TABLE security_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,            -- 'Conta Google', '2FA Supabase', 'Backup VPS'
  type TEXT NOT NULL CHECK (type IN ('account', 'backup', '2fa', 'recovery', 'password_manager', 'other')),
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'needs_attention', 'critical')),
  last_verified DATE,
  next_review DATE,
  notes TEXT,                    -- NUNCA salvar senhas em plain text aqui
  metadata JSONB DEFAULT '{}'
);

-- Índice de urgência
CREATE INDEX idx_security_status ON security_items(status) WHERE status != 'ok';
CREATE INDEX idx_security_next_review ON security_items(next_review) WHERE next_review IS NOT NULL;
