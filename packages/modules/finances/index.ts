// Module: Finances
// Gestão financeira: transações, contas, categorias, relatórios

export type {
  FinanceCategory,
  FinanceAccount,
  FinanceTransaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  FinanceSummary,
  FinanceRecurring,
} from './types';

export {
  createTransaction,
  listTransactions,
  getFinanceSummary,
  getCategories,
  getAccounts,
  getAccount,
  updateAccountBalance,
  getCategory,
  getBudgetVsActual,
  upsertBudget,
  getOverBudgetCategories,
  snapshotNetWorth,
  getNetWorthHistory,
  getPortfolioPositions,
  getPortfolioAllocation,
  upsertQuote,
  findOrCreateAsset,
  deleteTransaction,
  updateTransaction,
} from './queries';

export {
  gastaCommand,
  receitaCommand,
  saldoCommand,
  handleGasto,
  handleReceita,
  handleSaldo,
} from './commands';

export { loadL0, loadL1, loadL2 } from './context';

export { MONTHLY_SPENDING_ALERT_THRESHOLD, SUBSTANCE_CATEGORIES, ACCOUNT_TYPES } from './constants';
