import { db } from '@hawk/db';
import { HawkError, createLogger } from '@hawk/shared';
import type { PaginatedResult } from '@hawk/shared';

const logger = createLogger('finances');

import type {
  BudgetVsActual,
  CategorySpending,
  FinanceRecurring,
  FinanceSummary,
  FinanceTransaction,
  NetWorthSnapshot,
  PortfolioAsset,
  PortfolioPosition,
  TransactionWithCategory,
} from './types';

/**
 * Obter resumo financeiro (saldo, receitas, despesas)
 */
export async function getFinanceSummary(
  accountId?: string,
  startDate?: string,
  endDate?: string,
): Promise<FinanceSummary> {
  let query = db.from('finance_transactions').select('amount, type');

  if (accountId) query = query.eq('account_id', accountId);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to get summary');
    throw new HawkError(`Failed to get summary: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const transactions = (data || []) as Pick<FinanceTransaction, 'amount' | 'type'>[];

  const summary = {
    income: 0,
    expenses: 0,
    transfers: 0,
    net: 0,
  };

  for (const t of transactions) {
    if (t.type === 'income') summary.income += t.amount;
    else if (t.type === 'expense') summary.expenses += t.amount;
    else if (t.type === 'transfer') summary.transfers += t.amount;
  }

  summary.net = summary.income - summary.expenses;

  return summary;
}

/**
 * Listar transações com nome/icon/cor da categoria (join)
 */
export async function listTransactionsWithCategory(
  accountId?: string,
  startDate?: string,
  endDate?: string,
  categoryId?: string,
  limit = 50,
  offset = 0,
): Promise<PaginatedResult<TransactionWithCategory>> {
  let query = db
    .from('finance_transactions')
    .select(
      'id, account_id, category_id, amount, type, description, date, tags, created_at, updated_at, finance_categories(name, icon, color)',
      { count: 'exact' },
    )
    .order('date', { ascending: false });

  if (accountId) query = query.eq('account_id', accountId);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  if (categoryId) query = query.eq('category_id', categoryId);
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list transactions with category');
    throw new HawkError(
      `Failed to list transactions with category: ${error.message}`,
      'DB_QUERY_FAILED',
    );
  }

  const total = count ?? 0;
  const items = (data ?? []).map((t: Record<string, unknown>) => {
    const cat = (t as Record<string, unknown>).finance_categories as {
      name: string;
      icon: string | null;
      color: string | null;
    } | null;
    return {
      ...(t as unknown as FinanceTransaction),
      category_name: cat?.name ?? 'Sem categoria',
      category_icon: cat?.icon ?? null,
      category_color: cat?.color ?? null,
    };
  });

  return { data: items, total, hasMore: offset + limit < total };
}

/**
 * Gastos agrupados por categoria (para breakdown visual)
 */
export async function getTransactionsByCategory(
  startDate: string,
  endDate?: string,
): Promise<CategorySpending[]> {
  let query = db
    .from('finance_transactions')
    .select('category_id, amount, finance_categories(name, icon, color)')
    .eq('type', 'expense')
    .gte('date', startDate);

  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to get category breakdown');
    throw new HawkError(`Failed to get category breakdown: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const grouped: Record<
    string,
    { name: string; icon: string | null; color: string | null; total: number }
  > = {};

  for (const row of data ?? []) {
    const cat = (row as Record<string, unknown>).finance_categories as {
      name: string;
      icon: string | null;
      color: string | null;
    } | null;
    const id = row.category_id;
    if (!id) continue;
    if (!grouped[id]) {
      grouped[id] = {
        name: cat?.name ?? 'Outros',
        icon: cat?.icon ?? null,
        color: cat?.color ?? null,
        total: 0,
      };
    }
    grouped[id].total += row.amount;
  }

  const entries = Object.entries(grouped).sort((a, b) => b[1].total - a[1].total);
  const grandTotal = entries.reduce((s, [, v]) => s + v.total, 0);

  return entries.map(([categoryId, v]) => ({
    category_id: categoryId,
    name: v.name,
    icon: v.icon,
    color: v.color,
    total: v.total,
    percentage: grandTotal > 0 ? v.total / grandTotal : 0,
  }));
}

/**
 * Recorrentes com vencimento nos próximos N dias
 */
export async function listUpcomingRecurring(daysAhead = 7): Promise<FinanceRecurring[]> {
  const today = new Date();
  const future = new Date(today);
  future.setDate(future.getDate() + daysAhead);

  const todayStr = today.toISOString().split('T')[0] as string;
  const futureStr = future.toISOString().split('T')[0] as string;

  const { data, error } = await db
    .from('finance_recurring')
    .select(
      'id, account_id, category_id, amount, type, description, frequency, start_date, end_date, next_due_date, enabled',
    )
    .eq('enabled', true)
    .gte('next_due_date', todayStr)
    .lte('next_due_date', futureStr)
    .order('next_due_date', { ascending: true });

  if (error) {
    logger.error({ error: error.message }, 'Failed to list upcoming recurring');
    throw new HawkError(`Failed to list upcoming recurring: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as FinanceRecurring[];
}

// ============================================================
// ENVELOPE BUDGETING (Actual Budget pattern)
// ============================================================

/**
 * Budget vs actual por mês — usa view finance_budget_vs_actual
 */
export async function getBudgetVsActual(month: string): Promise<BudgetVsActual[]> {
  // biome-ignore lint/suspicious/noExplicitAny: table added via migration, types not regenerated
  const { data, error } = await (db as any)
    .from('finance_budget_vs_actual')
    .select('*')
    .eq('month', `${month}-01`);
  if (error) {
    logger.error({ error: error.message }, 'Failed to get budget vs actual');
    throw new HawkError(`Failed to get budget vs actual: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as BudgetVsActual[];
}

/**
 * Criar ou atualizar orçamento mensal de uma categoria
 */
export async function upsertBudget(
  categoryId: string,
  month: string,
  amount: number,
  carryover = 0,
): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: table added via migration, types not regenerated
  await (db as any)
    .from('finance_budgets')
    .upsert({
      category_id: categoryId,
      month: `${month}-01`,
      budgeted_amount: amount,
      carryover_amount: carryover,
    })
    .throwOnError();
}

/**
 * Categorias acima do orçamento no mês
 */
export async function getOverBudgetCategories(month: string): Promise<BudgetVsActual[]> {
  const all = await getBudgetVsActual(month);
  return all.filter((b) => b.remaining_amount < 0);
}

/**
 * Aplicar regras de categorização automática a uma transação
 */
export async function applyCategorizationRules(
  description: string,
  amount: number,
): Promise<{ categoryId: string | null; payee: string | null }> {
  // biome-ignore lint/suspicious/noExplicitAny: table added via migration, types not regenerated
  const { data } = await (db as any)
    .from('finance_categorization_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  // biome-ignore lint/suspicious/noExplicitAny: rule typed as any since table not in generated types
  for (const rule of (data ?? []) as any[]) {
    const val = rule.condition_value as string;
    const matches =
      rule.condition_field === 'description' && rule.condition_operator === 'contains'
        ? description.toLowerCase().includes(val.toLowerCase())
        : rule.condition_field === 'amount' && rule.condition_operator === 'gt'
          ? amount > Number(val)
          : rule.condition_field === 'amount' && rule.condition_operator === 'lt'
            ? amount < Number(val)
            : false;

    if (matches) {
      return { categoryId: rule.category_id, payee: rule.payee ?? null };
    }
  }

  return { categoryId: null, payee: null };
}

/**
 * Snapshot mensal de net worth
 */
export async function snapshotNetWorth(
  totalAssets: number,
  totalLiabilities: number,
  breakdown: Record<string, number>,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  // biome-ignore lint/suspicious/noExplicitAny: table added via migration, types not regenerated
  await (db as any)
    .from('finance_net_worth_snapshots')
    .upsert({
      snapshot_date: today,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      breakdown,
    })
    .throwOnError();
}

/**
 * Histórico de net worth (para gráfico)
 */
export async function getNetWorthHistory(months = 12): Promise<NetWorthSnapshot[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - months);

  // biome-ignore lint/suspicious/noExplicitAny: table added via migration, types not regenerated
  const { data, error } = await (db as any)
    .from('finance_net_worth_snapshots')
    .select('snapshot_date, total_assets, total_liabilities, net_worth, breakdown')
    .gte('snapshot_date', from.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true });
  if (error) {
    logger.error({ error: error.message }, 'Failed to get net worth history');
    throw new HawkError(`Failed to get net worth history: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as NetWorthSnapshot[];
}

// ============================================================
// PORTFOLIO (Ghostfolio pattern)
// ============================================================

/**
 * Listar posições atuais — usa view portfolio_positions
 */
export async function getPortfolioPositions(): Promise<PortfolioPosition[]> {
  // biome-ignore lint/suspicious/noExplicitAny: table added via migration, types not regenerated
  const { data, error } = await (db as any)
    .from('portfolio_positions')
    .select('*')
    .order('current_value', { ascending: false });
  if (error) {
    logger.error({ error: error.message }, 'Failed to get portfolio positions');
    throw new HawkError(`Failed to get portfolio positions: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as PortfolioPosition[];
}

/**
 * Allocation por classe de ativo
 */
export async function getPortfolioAllocation(): Promise<
  { asset_class: string; total_value: number; percentage: number }[]
> {
  const positions = await getPortfolioPositions();
  const totalValue = positions.reduce((s, p) => s + (p.current_value ?? 0), 0);
  if (totalValue === 0) return [];

  const grouped: Record<string, number> = {};
  for (const p of positions) {
    grouped[p.asset_class] = (grouped[p.asset_class] ?? 0) + (p.current_value ?? 0);
  }

  return Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .map(([asset_class, total_value]) => ({
      asset_class,
      total_value,
      percentage: (total_value / totalValue) * 100,
    }));
}

/**
 * Registrar cotação atual de um ativo
 */
export async function upsertQuote(
  assetId: string,
  price: number,
  changePct?: number,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  // biome-ignore lint/suspicious/noExplicitAny: table added via migration, types not regenerated
  await (db as any)
    .from('portfolio_quotes')
    .upsert({ asset_id: assetId, price, change_pct: changePct ?? null, quote_date: today })
    .throwOnError();
}

/**
 * Buscar ou criar ativo por ticker
 */
export async function findOrCreateAsset(
  ticker: string,
  name: string,
  assetClass: string,
): Promise<PortfolioAsset> {
  // biome-ignore lint/suspicious/noExplicitAny: table added via migration, types not regenerated
  const { data: existing } = await (db as any)
    .from('portfolio_assets')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .maybeSingle();

  if (existing) return existing as PortfolioAsset;

  // biome-ignore lint/suspicious/noExplicitAny: table added via migration, types not regenerated
  const { data, error } = await (db as any)
    .from('portfolio_assets')
    .insert({ ticker: ticker.toUpperCase(), name, asset_class: assetClass })
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to create asset');
    throw new HawkError(`Failed to create asset: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as PortfolioAsset;
}
