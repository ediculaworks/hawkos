-- =============================================================================
-- Migration 0005: Seed Finances + Calendar
-- Dados iniciais: categorias, contas padrão, calendário padrão
-- =============================================================================

BEGIN;

-- Categorias de despesa padrão
INSERT INTO finance_categories (name, type, color, icon) VALUES
  ('Alimentação', 'expense', '#FF6B6B', '🍔'),
  ('Transporte', 'expense', '#4ECDC4', '🚗'),
  ('Moradia', 'expense', '#45B7D1', '🏠'),
  ('Saúde', 'expense', '#96CEB4', '⚕️'),
  ('Educação', 'expense', '#FFEAA7', '📚'),
  ('Entretenimento', 'expense', '#DDA0DD', '🎮'),
  ('Compras', 'expense', '#FFB6C1', '🛍️'),
  ('Serviços', 'expense', '#A8DADC', '🔧'),
  ('Utilities', 'expense', '#F1FAEE', '💡'),
  ('Cannabis', 'expense', '#90EE90', '🌿'),
  ('Outros', 'expense', '#CCCCCC', '📝')
ON CONFLICT DO NOTHING;

-- Categorias de receita padrão
INSERT INTO finance_categories (name, type, color, icon) VALUES
  ('Salário', 'income', '#52B788', '💼'),
  ('Freelance', 'income', '#2D6A4F', '💻'),
  ('Investimentos', 'income', '#1D3557', '📈'),
  ('Outros Rendimentos', 'income', '#457B9D', '💰')
ON CONFLICT DO NOTHING;

-- Contas padrão (atualize com suas contas)
INSERT INTO finance_accounts (name, type, currency, balance) VALUES
  ('Conta Corrente', 'checking', 'BRL', 0.00),
  ('Cartão de Crédito', 'credit_card', 'BRL', 0.00),
  ('Poupança', 'savings', 'BRL', 0.00),
  ('Investimentos', 'investment', 'BRL', 0.00)
ON CONFLICT DO NOTHING;

-- Calendário padrão
INSERT INTO calendar_sync_config (calendar_id, calendar_name, sync_enabled) VALUES
  ('personal', 'Pessoal', true)
ON CONFLICT DO NOTHING;

COMMIT;
