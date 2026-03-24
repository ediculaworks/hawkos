'use client';

import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import type { FinanceAccount } from '@hawk/module-finances/types';

type Props = {
  accounts: FinanceAccount[];
};

export function AccountsSidebar({ accounts }: Props) {
  if (accounts.length === 0) return null;

  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-[var(--space-2)]">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Contas
        </span>
        <span className="text-xs font-mono font-semibold text-[var(--color-text-primary)]">
          {formatCurrency(total)}
        </span>
      </div>
      {accounts.map((a) => (
        <div key={a.id} className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)] truncate">{a.name}</span>
          <span
            className={cn(
              'text-xs font-mono',
              a.balance >= 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-danger)]',
            )}
          >
            {formatCurrency(a.balance)}
          </span>
        </div>
      ))}
    </div>
  );
}
