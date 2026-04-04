'use client';

import { Badge } from '@/components/ui/badge';
import { fetchAccounts, fetchFinanceSummary } from '@/lib/actions/finances';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

export default function FinancesSummaryWidget() {
  const { data: summary } = useQuery({
    queryKey: ['finances', 'summary'],
    queryFn: () => fetchFinanceSummary(),
  });

  const { data: accounts } = useQuery({
    queryKey: ['finances', 'accounts'],
    queryFn: () => fetchAccounts(),
  });

  const totalBalance = useMemo(
    () => accounts?.reduce((sum, a) => sum + Number(a.balance || 0), 0) ?? 0,
    [accounts],
  );
  const netIsPositive = (summary?.net ?? 0) >= 0;

  return (
    <div className="space-y-[var(--space-4)]">
      {/* Total balance */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-[var(--space-1)]">
            Saldo total
          </p>
        </div>
        <Badge variant={netIsPositive ? 'success' : 'danger'}>
          {netIsPositive ? '+' : ''}
          {formatCurrency(summary?.net ?? 0)}
        </Badge>
      </div>

      {/* Income / Expense / Transfers */}
      <div className="grid grid-cols-3 gap-[var(--space-3)]">
        <MetricItem
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Receitas"
          value={formatCurrency(summary?.income ?? 0)}
          colorVar="var(--color-success)"
        />
        <MetricItem
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          label="Despesas"
          value={formatCurrency(summary?.expenses ?? 0)}
          colorVar="var(--color-danger)"
        />
        <MetricItem
          icon={<ArrowUpDown className="h-3.5 w-3.5" />}
          label="Transf."
          value={formatCurrency(summary?.transfers ?? 0)}
          colorVar="var(--color-text-muted)"
        />
      </div>

      {/* Account list */}
      {accounts && accounts.length > 0 && (
        <div className="border-t border-[var(--color-border-subtle)] pt-[var(--space-3)] space-y-[var(--space-2)]">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">{account.name}</span>
              <span
                className={cn(
                  'font-mono text-xs',
                  account.balance >= 0
                    ? 'text-[var(--color-text-primary)]'
                    : 'text-[var(--color-danger)]',
                )}
              >
                {formatCurrency(account.balance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricItem({
  icon,
  label,
  value,
  colorVar,
}: { icon: React.ReactNode; label: string; value: string; colorVar: string }) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <div className="flex items-center gap-[var(--space-1)]" style={{ color: colorVar }}>
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}
