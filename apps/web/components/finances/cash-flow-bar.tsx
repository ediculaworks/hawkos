'use client';

import { formatCurrency } from '@/lib/utils/format';
import type { FinanceSummary } from '@hawk/module-finances/types';

type Props = {
  current: FinanceSummary;
  previous: FinanceSummary | null;
};

export function CashFlowBar({ current, previous }: Props) {
  const max = Math.max(current.income, current.expenses, 1);
  const incomeWidth = (current.income / max) * 100;
  const expenseWidth = (current.expenses / max) * 100;

  const incomeDelta =
    previous && previous.income > 0
      ? ((current.income - previous.income) / previous.income) * 100
      : null;
  const expenseDelta =
    previous && previous.expenses > 0
      ? ((current.expenses - previous.expenses) / previous.expenses) * 100
      : null;

  return (
    <div className="space-y-[var(--space-4)]">
      {/* Income */}
      <div className="space-y-[var(--space-1)]">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-medium text-[var(--color-success)]">Receitas</span>
          <div className="flex items-baseline gap-[var(--space-2)]">
            <span className="text-sm font-semibold text-[var(--color-text-primary)] font-mono">
              {formatCurrency(current.income)}
            </span>
            {incomeDelta !== null && <DeltaBadge value={incomeDelta} invertColor />}
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-success)] transition-all duration-500"
            style={{ width: `${incomeWidth}%` }}
          />
        </div>
      </div>

      {/* Expenses */}
      <div className="space-y-[var(--space-1)]">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-medium text-[var(--color-danger)]">Despesas</span>
          <div className="flex items-baseline gap-[var(--space-2)]">
            <span className="text-sm font-semibold text-[var(--color-text-primary)] font-mono">
              {formatCurrency(current.expenses)}
            </span>
            {expenseDelta !== null && <DeltaBadge value={expenseDelta} />}
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-danger)] transition-all duration-500"
            style={{ width: `${expenseWidth}%` }}
          />
        </div>
      </div>

      {/* Net */}
      <div className="flex items-baseline justify-between pt-[var(--space-2)] border-t border-[var(--color-border-subtle)]">
        <span className="text-[11px] text-[var(--color-text-muted)]">Líquido</span>
        <span
          className="text-lg font-bold font-mono"
          style={{ color: current.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
        >
          {current.net >= 0 ? '+' : ''}
          {formatCurrency(current.net)}
        </span>
      </div>
    </div>
  );
}

function DeltaBadge({ value, invertColor }: { value: number; invertColor?: boolean }) {
  const isPositive = value >= 0;
  const isGood = invertColor ? isPositive : !isPositive;
  const color = isGood ? 'var(--color-success)' : 'var(--color-danger)';
  const arrow = isPositive ? '↑' : '↓';

  return (
    <span className="text-[10px] font-medium" style={{ color }}>
      {arrow}
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}
