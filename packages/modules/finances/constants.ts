/**
 * Thresholds e alertas financeiros
 */
export const MONTHLY_SPENDING_ALERT_THRESHOLD = 4000;
export const WEEKLY_SPENDING_ALERT_THRESHOLD = 1000;
export const HIGH_TRANSACTION_THRESHOLD = 500;

/**
 * Categorias de substâncias que requerem tracking especial
 */
export const SUBSTANCE_CATEGORIES = ['Cannabis', 'Álcool', 'Tabaco'] as const;

/**
 * Frequências de transações recorrentes
 */
export const RECURRING_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
] as const;

/**
 * Tipos de contas suportadas
 */
export const ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'investment', 'cash'] as const;

/**
 * Tipos de transações
 */
export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;

/**
 * Strings de resposta padrão
 */
export const MESSAGES = {
  SUCCESS_EXPENSE_CREATED: '✅ Gasto registrado com sucesso!',
  SUCCESS_INCOME_CREATED: '✅ Receita registrada com sucesso!',
  ERROR_INVALID_AMOUNT: '❌ O valor deve ser um número positivo.',
  ERROR_CATEGORY_NOT_FOUND: '❌ Categoria não encontrada.',
  ERROR_ACCOUNT_NOT_FOUND: '❌ Nenhuma conta encontrada.',
  WARNING_HIGH_SPENDING: '⚠️ Alerta: Gasto acima do threshold mensal!',
} as const;
