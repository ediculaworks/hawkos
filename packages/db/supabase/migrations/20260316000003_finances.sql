-- =============================================================================
-- Migration 0003: Schema Finances
-- Módulo de gestão financeira: contas, transações, categorias, gastos recorrentes
-- =============================================================================

BEGIN;

-- Categorias de gasto/receita (enum-like)
CREATE TABLE IF NOT EXISTS finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'investment')),
  icon TEXT,
  color TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_finance_categories_type ON finance_categories(type);

-- Contas bancárias e cartões
CREATE TABLE IF NOT EXISTS finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit_card', 'investment', 'cash')),
  currency TEXT DEFAULT 'BRL',
  balance NUMERIC(12, 2) DEFAULT 0.00,
  metadata JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_finance_accounts_type ON finance_accounts(type);
CREATE INDEX idx_finance_accounts_enabled ON finance_accounts(enabled);

-- Transações: despesas, receitas, investimentos
CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES finance_categories(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount != 0),
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_finance_transactions_account_id ON finance_transactions(account_id);
CREATE INDEX idx_finance_transactions_category_id ON finance_transactions(category_id);
CREATE INDEX idx_finance_transactions_date ON finance_transactions(date DESC);
CREATE INDEX idx_finance_transactions_type ON finance_transactions(type);

-- Transações recorrentes (assinaturas, salário, etc)
CREATE TABLE IF NOT EXISTS finance_recurring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES finance_categories(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  description TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  next_due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_finance_recurring_account_id ON finance_recurring(account_id);
CREATE INDEX idx_finance_recurring_next_due_date ON finance_recurring(next_due_date);
CREATE INDEX idx_finance_recurring_enabled ON finance_recurring(enabled);

-- RLS
ALTER TABLE finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_recurring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON finance_categories FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON finance_accounts FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON finance_transactions FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON finance_recurring FOR ALL TO authenticated USING (true);

ALTER TABLE finance_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE finance_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE finance_recurring FORCE ROW LEVEL SECURITY;

-- Triggers para atualizar updated_at
CREATE TRIGGER finance_categories_updated_at
  BEFORE UPDATE ON finance_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER finance_accounts_updated_at
  BEFORE UPDATE ON finance_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER finance_transactions_updated_at
  BEFORE UPDATE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER finance_recurring_updated_at
  BEFORE UPDATE ON finance_recurring
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
