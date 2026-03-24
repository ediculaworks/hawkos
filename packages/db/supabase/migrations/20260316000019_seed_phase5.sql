-- Seed: Phase 5 — Knowledge, Assets, Housing, Security

-- Moradia atual
INSERT INTO residences (name, address, type, rent_due_day) VALUES
  ('Apto BH', 'Belo Horizonte, MG', 'rented', 10);

-- Contas de moradia recorrentes
INSERT INTO housing_bills (residence_id, name, due_day, auto_debit) VALUES
  ((SELECT id FROM residences WHERE name = 'Apto BH'), 'Aluguel', 10, false),
  ((SELECT id FROM residences WHERE name = 'Apto BH'), 'Conta de Luz', 15, false),
  ((SELECT id FROM residences WHERE name = 'Apto BH'), 'Internet', 20, true),
  ((SELECT id FROM residences WHERE name = 'Apto BH'), 'Água', 20, false);

-- Checklist de segurança digital inicial
INSERT INTO security_items (name, type, status, next_review) VALUES
  ('2FA Google', '2fa', 'ok', CURRENT_DATE + 90),
  ('2FA GitHub', '2fa', 'ok', CURRENT_DATE + 90),
  ('2FA Supabase', '2fa', 'needs_attention', CURRENT_DATE + 7),
  ('2FA Discord', '2fa', 'needs_attention', CURRENT_DATE + 7),
  ('Gerenciador de Senhas (Bitwarden)', 'password_manager', 'needs_attention', CURRENT_DATE + 7),
  ('Recovery codes Google', 'recovery', 'needs_attention', CURRENT_DATE + 7),
  ('Backup Supabase', 'backup', 'ok', CURRENT_DATE + 30),
  ('Backup VPS', 'backup', 'needs_attention', CURRENT_DATE + 7);

-- Habilitar módulos da Fase 5
UPDATE modules SET enabled = true
WHERE id IN ('knowledge', 'assets', 'housing', 'security');
