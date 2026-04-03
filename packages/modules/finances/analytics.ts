import { db } from '@hawk/db';

/**
 * Financial Analytics — Statistical Models
 *
 * B1: Anomaly Detection (Z-score per category)
 *   Detects transactions that are statistically unusual compared to
 *   the user's historical spending pattern in that category.
 *
 * B3: Spending Forecast (Exponential Smoothing)
 *   Predicts end-of-month spending per category using weighted moving average
 *   that gives more importance to recent spending patterns.
 */

// ── Types ──────────────────────────────────────────────────

export type SpendingAnomaly = {
  transaction_id: string;
  amount: number;
  category_name: string;
  category_id: string;
  date: string;
  description: string;
  z_score: number;
  category_mean: number;
  category_std: number;
  severity: 'mild' | 'moderate' | 'extreme';
};

export type CategoryForecast = {
  category_id: string;
  category_name: string;
  current_month_spent: number;
  forecast_month_total: number;
  budgeted_amount: number | null;
  over_budget: boolean;
  over_budget_pct: number | null;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: 'low' | 'medium' | 'high';
};

// ── B1: Anomaly Detection ──────────────────────────────────

/**
 * Detect spending anomalies using Z-score method.
 *
 * For each expense transaction in the recent period, compare it against
 * the historical mean and standard deviation for that category.
 * Transactions with |z-score| > 2 are flagged as anomalies.
 *
 * Z-score = (value - mean) / std_deviation
 *   |z| > 2.0 → mild anomaly (~5% probability)
 *   |z| > 2.5 → moderate anomaly (~1% probability)
 *   |z| > 3.0 → extreme anomaly (~0.3% probability)
 */
export async function detectSpendingAnomalies(
  lookbackDays = 90,
  recentDays = 7,
): Promise<SpendingAnomaly[]> {
  // Get historical transactions for baseline (last N days)
  const baselineStart = new Date();
  baselineStart.setDate(baselineStart.getDate() - lookbackDays);

  const { data: historicalData, error: histError } = await db
    .from('finance_transactions')
    .select('id, amount, category_id, date, description, type')
    .eq('type', 'expense')
    .gte('date', baselineStart.toISOString().slice(0, 10))
    .order('date', { ascending: false });

  if (histError || !historicalData || historicalData.length < 5) return [];

  // Compute mean and std per category
  const categoryStats = new Map<string, { sum: number; sumSq: number; count: number }>();

  for (const tx of historicalData) {
    const catId = tx.category_id as string;
    const amount = Math.abs(tx.amount as number);
    const stats = categoryStats.get(catId) ?? { sum: 0, sumSq: 0, count: 0 };
    stats.sum += amount;
    stats.sumSq += amount * amount;
    stats.count++;
    categoryStats.set(catId, stats);
  }

  const categoryMeanStd = new Map<string, { mean: number; std: number }>();
  for (const [catId, stats] of categoryStats) {
    if (stats.count < 3) continue; // Need at least 3 data points
    const mean = stats.sum / stats.count;
    const variance = stats.sumSq / stats.count - mean * mean;
    const std = Math.sqrt(Math.max(variance, 0));
    if (std > 0) {
      categoryMeanStd.set(catId, { mean, std });
    }
  }

  // Get category names
  const catIds = [...categoryMeanStd.keys()];
  const { data: categories } = await db
    .from('finance_categories')
    .select('id, name')
    .in('id', catIds);

  const catNameMap = new Map<string, string>();
  for (const cat of categories ?? []) {
    catNameMap.set(cat.id as string, cat.name as string);
  }

  // Check recent transactions for anomalies
  const recentStart = new Date();
  recentStart.setDate(recentStart.getDate() - recentDays);

  const recentTransactions = historicalData.filter(
    (tx: any) => new Date(tx.date as string) >= recentStart,
  );

  const anomalies: SpendingAnomaly[] = [];

  for (const tx of recentTransactions) {
    const catId = tx.category_id as string;
    const stats = categoryMeanStd.get(catId);
    if (!stats) continue;

    const amount = Math.abs(tx.amount as number);
    const zScore = (amount - stats.mean) / stats.std;

    if (Math.abs(zScore) >= 2.0) {
      let severity: SpendingAnomaly['severity'] = 'mild';
      if (Math.abs(zScore) >= 3.0) severity = 'extreme';
      else if (Math.abs(zScore) >= 2.5) severity = 'moderate';

      anomalies.push({
        transaction_id: tx.id as string,
        amount,
        category_name: catNameMap.get(catId) ?? 'Desconhecido',
        category_id: catId,
        date: tx.date as string,
        description: (tx.description as string) ?? '',
        z_score: Math.round(zScore * 100) / 100,
        category_mean: Math.round(stats.mean * 100) / 100,
        category_std: Math.round(stats.std * 100) / 100,
        severity,
      });
    }
  }

  return anomalies.sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));
}

// ── B3: Spending Forecast ──────────────────────────────────

/**
 * Forecast end-of-month spending per category using exponential smoothing.
 *
 * Exponential smoothing (Simple):
 *   forecast = alpha * current + (1 - alpha) * previous_forecast
 *
 * Alpha (smoothing factor):
 *   0.3 = conservative, more weight on historical pattern
 *   0.5 = balanced
 *   0.7 = aggressive, more weight on recent data
 *
 * We use alpha=0.4 — slightly conservative, good for personal finance.
 *
 * The forecast projects current-month pace to end-of-month:
 *   daily_rate = month_spent_so_far / days_elapsed
 *   naive_forecast = daily_rate * days_in_month
 *   smoothed_forecast = alpha * naive_forecast + (1 - alpha) * historical_avg
 */
export async function forecastMonthlySpending(alpha = 0.4): Promise<CategoryForecast[]> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  if (dayOfMonth < 3) return []; // Too early to forecast

  // Get last 3 months of spending by category
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const { data: transactions, error } = await db
    .from('finance_transactions')
    .select('amount, category_id, date, type')
    .eq('type', 'expense')
    .gte('date', threeMonthsAgo.toISOString().slice(0, 10))
    .order('date', { ascending: true });

  if (error || !transactions || transactions.length === 0) return [];

  // Group spending by category and month
  const categoryMonthly = new Map<string, Map<string, number>>();

  for (const tx of transactions) {
    const catId = tx.category_id as string;
    const txDate = tx.date as string;
    const month = txDate.slice(0, 7); // YYYY-MM
    const amount = Math.abs(tx.amount as number);

    if (!categoryMonthly.has(catId)) categoryMonthly.set(catId, new Map());
    const monthMap = categoryMonthly.get(catId);
    if (monthMap) {
      monthMap.set(month, (monthMap.get(month) ?? 0) + amount);
    }
  }

  // Get category names
  const catIds = [...categoryMonthly.keys()];
  const { data: categories } = await db
    .from('finance_categories')
    .select('id, name')
    .in('id', catIds);

  const catNameMap = new Map<string, string>();
  for (const cat of categories ?? []) {
    catNameMap.set(cat.id as string, cat.name as string);
  }

  // Get budgets for current month
  const { data: budgets } = await db
    .from('finance_budgets')
    .select('category_id, budgeted_amount')
    .eq('month', `${currentMonth}-01`);

  const budgetMap = new Map<string, number>();
  for (const b of budgets ?? []) {
    budgetMap.set(b.category_id as string, b.budgeted_amount as number);
  }

  // Compute forecasts
  const forecasts: CategoryForecast[] = [];

  for (const [catId, monthlySpending] of categoryMonthly) {
    const currentMonthSpent = monthlySpending.get(currentMonth) ?? 0;

    // Get historical monthly totals (excluding current month)
    const historicalMonths = [...monthlySpending.entries()]
      .filter(([m]) => m !== currentMonth)
      .map(([, total]) => total);

    if (historicalMonths.length === 0 && currentMonthSpent === 0) continue;

    // Historical average
    const historicalAvg =
      historicalMonths.length > 0
        ? historicalMonths.reduce((s, v) => s + v, 0) / historicalMonths.length
        : currentMonthSpent;

    // Naive pace-based forecast
    const dailyRate = currentMonthSpent / dayOfMonth;
    const naiveForecast = dailyRate * daysInMonth;

    // Exponential smoothing: blend naive forecast with historical
    const forecastTotal =
      currentMonthSpent > 0 ? alpha * naiveForecast + (1 - alpha) * historicalAvg : historicalAvg;

    // Determine trend
    let trend: CategoryForecast['trend'] = 'stable';
    if (historicalMonths.length >= 2) {
      const recent = historicalMonths[historicalMonths.length - 1] ?? 0;
      const previous = historicalMonths[historicalMonths.length - 2] ?? 0;
      if (previous > 0) {
        const changePct = (recent - previous) / previous;
        if (changePct > 0.15) trend = 'increasing';
        else if (changePct < -0.15) trend = 'decreasing';
      }
    }

    // Budget comparison
    const budget = budgetMap.get(catId) ?? null;
    const overBudget = budget !== null ? forecastTotal > budget : false;
    const overBudgetPct =
      budget !== null && budget > 0 ? Math.round(((forecastTotal - budget) / budget) * 100) : null;

    // Confidence based on data availability
    let confidence: CategoryForecast['confidence'] = 'low';
    if (historicalMonths.length >= 3 && dayOfMonth >= 15) confidence = 'high';
    else if (historicalMonths.length >= 2 || dayOfMonth >= 10) confidence = 'medium';

    forecasts.push({
      category_id: catId,
      category_name: catNameMap.get(catId) ?? 'Desconhecido',
      current_month_spent: Math.round(currentMonthSpent * 100) / 100,
      forecast_month_total: Math.round(forecastTotal * 100) / 100,
      budgeted_amount: budget,
      over_budget: overBudget,
      over_budget_pct: overBudgetPct,
      trend,
      confidence,
    });
  }

  return forecasts
    .filter((f) => f.forecast_month_total > 0)
    .sort((a, b) => b.forecast_month_total - a.forecast_month_total);
}

/**
 * Format anomalies into a human-readable alert message.
 */
export function formatAnomalyAlert(anomalies: SpendingAnomaly[]): string {
  if (anomalies.length === 0) return '';

  const lines = anomalies.map((a) => {
    const emoji = a.severity === 'extreme' ? '[!!!]' : a.severity === 'moderate' ? '[!!]' : '[!]';
    return `${emoji} R$${a.amount.toFixed(2)} em ${a.category_name} (${a.description || 'sem desc'}) — ${a.z_score.toFixed(1)}x desvio da média R$${a.category_mean.toFixed(2)}`;
  });

  return `Gastos atípicos detectados:\n${lines.join('\n')}`;
}

/**
 * Format forecasts into a human-readable summary.
 */
export function formatForecastSummary(forecasts: CategoryForecast[]): string {
  if (forecasts.length === 0) return '';

  const overBudget = forecasts.filter((f) => f.over_budget);
  const lines: string[] = [];

  if (overBudget.length > 0) {
    lines.push('Categorias projetadas acima do orçamento:');
    for (const f of overBudget) {
      lines.push(
        `  - ${f.category_name}: R$${f.forecast_month_total.toFixed(0)} previsto (budget R$${f.budgeted_amount?.toFixed(0)}, +${f.over_budget_pct}%)`,
      );
    }
  }

  const topSpending = forecasts.slice(0, 5);
  lines.push('\nTop 5 gastos projetados:');
  for (const f of topSpending) {
    const trendArrow = f.trend === 'increasing' ? ' ^' : f.trend === 'decreasing' ? ' v' : '';
    lines.push(
      `  - ${f.category_name}: R$${f.forecast_month_total.toFixed(0)}${trendArrow} (conf: ${f.confidence})`,
    );
  }

  return lines.join('\n');
}
