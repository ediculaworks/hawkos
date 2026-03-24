'use client';

import { formatCurrency, formatRelativeDay } from '@/lib/utils/format';
import type { FinanceRecurring } from '@hawk/module-finances/types';

type Props = {
  recurring: FinanceRecurring[];
};

export function UpcomingBills({ recurring }: Props) {
  if (recurring.length === 0) return null;

  return (
    <div className="space-y-[var(--space-2)]">
      <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        Próximos
      </span>
      {recurring.map((r) => (
        <div key={r.id} className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)] truncate flex-1">
            {r.description}
          </span>
          <span className="text-xs font-mono text-[var(--color-text-primary)] flex-shrink-0 ml-[var(--space-2)]">
            {formatCurrency(r.amount)}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] w-12 text-right flex-shrink-0">
            {formatRelativeDay(r.next_due_date)}
          </span>
        </div>
      ))}
    </div>
  );
}
