'use server';

import {
  createAccount,
  createTransaction,
  deleteTransaction,
  disableAccount,
  getAccounts,
  getBudgetVsActual,
  getCategories,
  getFinanceSummary,
  getNetWorthHistory,
  getPortfolioAllocation,
  getPortfolioPositions,
  getTransactionsByCategory,
  listTransactionsWithCategory,
  listUpcomingRecurring,
  updateAccount,
  updateTransaction,
  upsertBudget,
} from '@hawk/module-finances/queries';
import type {
  BudgetVsActual,
  CategorySpending,
  CreateTransactionInput,
  FinanceAccount,
  FinanceRecurring,
  FinanceSummary,
  FinanceTransaction,
  NetWorthSnapshot,
  PortfolioPosition,
  UpdateTransactionInput,
} from '@hawk/module-finances/types';
import { revalidateTag, unstable_cache } from 'next/cache';
import { getTenantSlug, withTenant } from '../supabase/with-tenant';

import {
  CreateAccountSchema,
  CreateTransactionSchema,
  UpdateAccountSchema,
  UpdateTransactionSchema,
} from '../schemas';

const SP_TZ = 'America/Sao_Paulo';

function getMonthStart(date?: Date): string {
  const d = date ?? new Date();
  const spDate = new Intl.DateTimeFormat('en-CA', { timeZone: SP_TZ }).format(d);
  const [year, month] = spDate.split('-');
  return `${year}-${month}-01`;
}

function getMonthEnd(date?: Date): string {
  const d = date ?? new Date();
  const spDate = new Intl.DateTimeFormat('en-CA', { timeZone: SP_TZ }).format(d);
  const [year, month] = spDate.split('-');
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
}

export async function fetchFinanceSummary(startDate?: string): Promise<FinanceSummary> {
  const slug = await getTenantSlug();
  const start = startDate ?? getMonthStart();
  return withTenant(() =>
    unstable_cache(() => getFinanceSummary(undefined, start), [`fin-summary-${slug}-${start}`], {
      revalidate: 300,
      tags: ['finances'],
    })(),
  );
}

export async function fetchAccounts(): Promise<FinanceAccount[]> {
  const slug = await getTenantSlug();
  return withTenant(() =>
    unstable_cache(() => getAccounts(), [`fin-accounts-${slug}`], {
      revalidate: 900,
      tags: ['finances'],
    })(),
  );
}

export async function fetchCategories(type?: 'income' | 'expense') {
  const slug = await getTenantSlug();
  return withTenant(() =>
    unstable_cache(() => getCategories(type), [`fin-categories-${slug}-${type ?? 'all'}`], {
      revalidate: 3600,
      tags: ['finances-categories'],
    })(),
  );
}

export async function fetchTransactionsWithCat(
  accountId?: string,
  startDate?: string,
  endDate?: string,
  categoryId?: string,
  limit = 50,
  offset = 0,
) {
  return withTenant(async () =>
    listTransactionsWithCategory(
      accountId,
      startDate ?? getMonthStart(),
      endDate ?? getMonthEnd(),
      categoryId,
      limit,
      offset,
    ),
  );
}

export async function fetchCategoryBreakdown(
  startDate?: string,
  endDate?: string,
): Promise<CategorySpending[]> {
  return withTenant(async () => getTransactionsByCategory(startDate ?? getMonthStart(), endDate));
}

export async function fetchUpcomingRecurring(daysAhead = 7): Promise<FinanceRecurring[]> {
  return withTenant(async () => listUpcomingRecurring(daysAhead));
}

export async function fetchMonthComparison(): Promise<{
  current: FinanceSummary;
  previous: FinanceSummary;
}> {
  return withTenant(async () => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [current, previous] = await Promise.all([
      getFinanceSummary(undefined, getMonthStart(now)),
      getFinanceSummary(undefined, getMonthStart(prevMonth), getMonthEnd(prevMonth)),
    ]);

    return { current, previous };
  });
}

export async function addTransaction(input: unknown): Promise<FinanceTransaction> {
  const res = await withTenant(async () => {
    const result = CreateTransactionSchema.safeParse(input);
    if (!result.success)
      throw new Error(`addTransaction: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return createTransaction(result.data as CreateTransactionInput);
  });
  revalidateTag('finances', 'default');
  return res;
}

export async function addAccount(input: unknown): Promise<FinanceAccount> {
  return withTenant(async () => {
    const result = CreateAccountSchema.safeParse(input);
    if (!result.success)
      throw new Error(`addAccount: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return createAccount({
      name: result.data.name,
      type: result.data.type,
      currency: result.data.currency,
      balance: result.data.balance,
    });
  });
}

export async function editAccount(id: string, updates: unknown): Promise<FinanceAccount> {
  return withTenant(async () => {
    const result = UpdateAccountSchema.safeParse(updates);
    if (!result.success)
      throw new Error(`editAccount: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return updateAccount(id, result.data);
  });
}

export async function removeAccount(id: string): Promise<void> {
  return withTenant(async () => disableAccount(id));
}

export async function editTransaction(id: string, updates: unknown): Promise<FinanceTransaction> {
  return withTenant(async () => {
    const result = UpdateTransactionSchema.safeParse(updates);
    if (!result.success)
      throw new Error(`editTransaction: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return updateTransaction(id, result.data as UpdateTransactionInput);
  });
}

export async function removeTransaction(id: string): Promise<void> {
  await withTenant(async () => deleteTransaction(id));
  revalidateTag('finances', 'default');
}

export async function fetchRecentTransactions(limit = 10) {
  return withTenant(async () => {
    const result = await listTransactionsWithCategory(
      undefined,
      getMonthStart(),
      getMonthEnd(),
      undefined,
      limit,
    );
    return result.data;
  });
}

export async function fetchBudgetStatus(month?: string): Promise<BudgetVsActual[]> {
  return withTenant(async () => {
    const m =
      month ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return getBudgetVsActual(m);
  });
}

export async function fetchPortfolioPositions(): Promise<PortfolioPosition[]> {
  return withTenant(async () => getPortfolioPositions());
}

export async function fetchPortfolioAllocation(): Promise<
  { asset_class: string; total_value: number; percentage: number }[]
> {
  return withTenant(async () => getPortfolioAllocation());
}

export async function fetchNetWorthHistory(months = 12): Promise<NetWorthSnapshot[]> {
  return withTenant(async () => getNetWorthHistory(months));
}

export async function upsertBudgetAction(
  categoryId: string,
  month: string,
  amount: number,
): Promise<void> {
  if (!categoryId || typeof categoryId !== 'string')
    throw new Error('upsertBudgetAction: categoryId inválido');
  if (!month || !/^\d{4}-\d{2}$/.test(month))
    throw new Error('upsertBudgetAction: month deve ser YYYY-MM');
  if (typeof amount !== 'number' || amount < 0)
    throw new Error('upsertBudgetAction: amount inválido');
  return withTenant(async () => upsertBudget(categoryId, month, amount));
}
