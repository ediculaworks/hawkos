-- Migration: Finances — Envelope Budgeting + Portfolio Tracking
-- Referências: docs/repositorios/actual-budget.md, docs/repositorios/ghostfolio.md
-- Tasks: I1.2.1–8

BEGIN;

-- ============================================================
-- ENVELOPE BUDGETING (Actual Budget pattern)
-- ============================================================

-- Orçamentos mensais por categoria (envelope method)
CREATE TABLE IF NOT EXISTS finance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES finance_categories(id) ON DELETE CASCADE,
  month DATE NOT NULL,           -- primeiro dia do mês: '2026-03-01'
  budgeted_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  carryover_amount NUMERIC(12,2) DEFAULT 0,  -- saldo positivo do mês anterior
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, month)
);

CREATE INDEX idx_finance_budgets_month ON finance_budgets(month DESC);
CREATE INDEX idx_finance_budgets_category ON finance_budgets(category_id);

ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage budgets" ON finance_budgets FOR ALL USING (true) WITH CHECK (true);

-- Regras de categorização automática
CREATE TABLE IF NOT EXISTS finance_categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority INT NOT NULL DEFAULT 50,
  condition_field TEXT NOT NULL CHECK (condition_field IN ('description', 'amount', 'payee')),
  condition_operator TEXT NOT NULL CHECK (condition_operator IN ('contains', 'matches', 'gt', 'lt', 'eq')),
  condition_value TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES finance_categories(id) ON DELETE CASCADE,
  payee TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_categorization_rules_priority ON finance_categorization_rules(priority, is_active);

ALTER TABLE finance_categorization_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage categorization rules" ON finance_categorization_rules FOR ALL USING (true) WITH CHECK (true);

-- Split de transação em múltiplas categorias
CREATE TABLE IF NOT EXISTS finance_transaction_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_transaction_id UUID NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  category_id UUID REFERENCES finance_categories(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transaction_splits_parent ON finance_transaction_splits(parent_transaction_id);

ALTER TABLE finance_transaction_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage transaction splits" ON finance_transaction_splits FOR ALL USING (true) WITH CHECK (true);

-- Snapshots mensais de net worth
CREATE TABLE IF NOT EXISTS finance_net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  total_assets NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_liabilities NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_worth NUMERIC(12,2),
  breakdown JSONB DEFAULT '{}',   -- { "checking": 5000, "investment": 20000, "real_estate": 0 }
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(snapshot_date)
);

CREATE INDEX idx_net_worth_snapshots_date ON finance_net_worth_snapshots(snapshot_date DESC);

ALTER TABLE finance_net_worth_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage net worth snapshots" ON finance_net_worth_snapshots FOR ALL USING (true) WITH CHECK (true);

-- View: budget vs actual por categoria/mês
CREATE OR REPLACE VIEW finance_budget_vs_actual AS
SELECT
  b.id AS budget_id,
  b.category_id,
  c.name AS category_name,
  c.type AS category_type,
  b.month,
  b.budgeted_amount,
  b.carryover_amount,
  b.budgeted_amount + COALESCE(b.carryover_amount, 0) AS available_amount,
  COALESCE(ABS(SUM(t.amount)), 0) AS spent_amount,
  b.budgeted_amount + COALESCE(b.carryover_amount, 0) - COALESCE(ABS(SUM(t.amount)), 0) AS remaining_amount
FROM finance_budgets b
JOIN finance_categories c ON c.id = b.category_id
LEFT JOIN finance_transactions t ON
  t.category_id = b.category_id
  AND date_trunc('month', t.date) = b.month
  AND t.amount < 0   -- só despesas
GROUP BY b.id, b.category_id, c.name, c.type, b.month, b.budgeted_amount, b.carryover_amount;

-- ============================================================
-- PORTFOLIO / INVESTIMENTOS (Ghostfolio pattern)
-- ============================================================

-- Adicionar tipo de investimento em contas
ALTER TABLE finance_accounts
  ADD COLUMN IF NOT EXISTS investment_type TEXT
  CHECK (investment_type IN ('stocks', 'crypto', 'fixed_income', 'real_estate', 'pension', 'savings'));

-- Ativos financeiros (ações, FIIs, cripto, renda fixa)
CREATE TABLE IF NOT EXISTS portfolio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,                -- 'PETR4', 'BTC', 'HGLG11', 'TESOURO_SELIC'
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN (
    'stock', 'etf', 'fii', 'bdr', 'crypto', 'fixed_income', 'pension', 'other'
  )),
  currency TEXT DEFAULT 'BRL',
  exchange TEXT,                       -- 'B3', 'NASDAQ', 'CRYPTO', 'TESOURO'
  sector TEXT,
  logo_url TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_portfolio_assets_ticker ON portfolio_assets(ticker);
CREATE INDEX idx_portfolio_assets_class ON portfolio_assets(asset_class);

ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage portfolio assets" ON portfolio_assets FOR ALL USING (true) WITH CHECK (true);

-- Transações de portfolio (compra, venda, dividendo, juros)
CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES finance_accounts(id) ON DELETE SET NULL,
  asset_id UUID NOT NULL REFERENCES portfolio_assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'dividend', 'jcp', 'split', 'bonification', 'fee', 'transfer')),
  quantity NUMERIC(18,8) NOT NULL,
  unit_price NUMERIC(18,6) NOT NULL,
  fee NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(18,2),
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_portfolio_transactions_asset ON portfolio_transactions(asset_id, date DESC);
CREATE INDEX idx_portfolio_transactions_date ON portfolio_transactions(date DESC);
CREATE INDEX idx_portfolio_transactions_type ON portfolio_transactions(type);

ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage portfolio transactions" ON portfolio_transactions FOR ALL USING (true) WITH CHECK (true);

-- Cotações históricas (cache de preços)
CREATE TABLE IF NOT EXISTS portfolio_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES portfolio_assets(id) ON DELETE CASCADE,
  price NUMERIC(18,6) NOT NULL,
  change_pct NUMERIC(8,4),             -- variação percentual do dia
  market_cap NUMERIC(18,2),
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id, quote_date)
);

CREATE INDEX idx_portfolio_quotes_asset_date ON portfolio_quotes(asset_id, quote_date DESC);

ALTER TABLE portfolio_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage portfolio quotes" ON portfolio_quotes FOR ALL USING (true) WITH CHECK (true);

-- View: posições atuais calculadas
CREATE OR REPLACE VIEW portfolio_positions AS
SELECT
  a.id AS asset_id,
  a.ticker,
  a.name,
  a.asset_class,
  a.currency,
  a.sector,
  SUM(CASE WHEN pt.type = 'buy' THEN pt.quantity
           WHEN pt.type = 'sell' THEN -pt.quantity
           WHEN pt.type IN ('split', 'bonification') THEN pt.quantity
           ELSE 0
      END) AS quantity,
  SUM(CASE WHEN pt.type = 'buy' THEN pt.total_amount
           WHEN pt.type = 'sell' THEN -pt.unit_price * pt.quantity
           ELSE 0
      END) AS total_cost,
  CASE
    WHEN SUM(CASE WHEN pt.type = 'buy' THEN pt.quantity
                  WHEN pt.type = 'sell' THEN -pt.quantity
                  ELSE 0 END) > 0
    THEN SUM(CASE WHEN pt.type = 'buy' THEN pt.total_amount
                  WHEN pt.type = 'sell' THEN -pt.unit_price * pt.quantity
                  ELSE 0 END) /
         SUM(CASE WHEN pt.type = 'buy' THEN pt.quantity
                  WHEN pt.type = 'sell' THEN -pt.quantity
                  ELSE 0 END)
    ELSE 0
  END AS average_price,
  q.price AS current_price,
  q.change_pct AS today_change_pct,
  SUM(CASE WHEN pt.type = 'buy' THEN pt.quantity
           WHEN pt.type = 'sell' THEN -pt.quantity
           ELSE 0
      END) * COALESCE(q.price, 0) AS current_value,
  q.quote_date AS price_date
FROM portfolio_assets a
JOIN portfolio_transactions pt ON pt.asset_id = a.id
  AND pt.type IN ('buy', 'sell', 'split', 'bonification')
LEFT JOIN LATERAL (
  SELECT price, change_pct, quote_date
  FROM portfolio_quotes
  WHERE asset_id = a.id
  ORDER BY quote_date DESC
  LIMIT 1
) q ON true
GROUP BY a.id, a.ticker, a.name, a.asset_class, a.currency, a.sector, q.price, q.change_pct, q.quote_date
HAVING SUM(CASE WHEN pt.type = 'buy' THEN pt.quantity
                WHEN pt.type = 'sell' THEN -pt.quantity
                ELSE 0 END) > 0;

-- Trigger updated_at em budgets
CREATE OR REPLACE FUNCTION update_finance_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finance_budgets_updated_at
  BEFORE UPDATE ON finance_budgets
  FOR EACH ROW EXECUTE FUNCTION update_finance_budgets_updated_at();

COMMIT;
