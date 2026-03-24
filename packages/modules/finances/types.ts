export type FinanceCategory = {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'investment';
  icon?: string;
  color?: string;
};

export type FinanceAccount = {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash';
  currency: string;
  balance: number;
  enabled: boolean;
};

export type FinanceTransaction = {
  id: string;
  account_id: string;
  category_id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description?: string;
  date: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
};

export type CreateTransactionInput = {
  account_id: string;
  category_id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description?: string;
  date?: string;
  tags?: string[];
};

export type UpdateTransactionInput = {
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
  description?: string;
  category_id?: string;
  account_id?: string;
  date?: string;
  tags?: string[];
};

export type FinanceSummary = {
  income: number;
  expenses: number;
  transfers: number;
  net: number;
};

export type TransactionWithCategory = FinanceTransaction & {
  category_name: string;
  category_icon: string | null;
  category_color: string | null;
};

export type CategorySpending = {
  category_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  total: number;
  percentage: number;
};

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash';

export type CreateAccountInput = {
  name: string;
  type: AccountType;
  currency?: string;
  balance?: number;
};

export type UpdateAccountInput = {
  name?: string;
  type?: AccountType;
  balance?: number;
  enabled?: boolean;
};

export type FinanceRecurring = {
  id: string;
  account_id: string;
  category_id: string;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date?: string;
  next_due_date: string;
  enabled: boolean;
};

// ── Envelope Budgeting ──────────────────────────────────────

export type BudgetVsActual = {
  budget_id: string;
  category_id: string;
  category_name: string;
  category_type: string;
  month: string;
  budgeted_amount: number;
  carryover_amount: number;
  available_amount: number;
  spent_amount: number;
  remaining_amount: number;
};

export type NetWorthSnapshot = {
  snapshot_date: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  breakdown: Record<string, number>;
};

// ── Portfolio ───────────────────────────────────────────────

export type PortfolioAsset = {
  id: string;
  ticker: string;
  name: string;
  asset_class: 'stock' | 'etf' | 'fii' | 'bdr' | 'crypto' | 'fixed_income' | 'pension' | 'other';
  currency: string;
  exchange: string | null;
  sector: string | null;
  is_active: boolean;
};

export type PortfolioPosition = {
  asset_id: string;
  ticker: string;
  name: string;
  asset_class: string;
  currency: string;
  sector: string | null;
  quantity: number;
  total_cost: number;
  average_price: number;
  current_price: number | null;
  today_change_pct: number | null;
  current_value: number | null;
  price_date: string | null;
};
