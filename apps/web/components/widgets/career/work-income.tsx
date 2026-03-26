'use client';

import { fetchWorkSummary } from '@/lib/actions/career';
import { fetchFinanceSummary } from '@/lib/actions/finances';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

export default function WorkIncomeWidget() {
  const { data: workSummary } = useQuery({
    queryKey: ['career', 'work-summary'],
    queryFn: () => fetchWorkSummary(),
  });

  const { data: financeSummary } = useQuery({
    queryKey: ['finances', 'summary'],
    queryFn: () => fetchFinanceSummary(),
  });

  const { totalHoursWeek, totalHoursMonth } = useMemo(() => {
    if (!workSummary) return { totalHoursWeek: 0, totalHoursMonth: 0 };
    return workSummary.reduce(
      (acc, ws) => ({
        totalHoursWeek: acc.totalHoursWeek + (ws.total_hours_week ?? 0),
        totalHoursMonth: acc.totalHoursMonth + (ws.total_hours_month ?? 0),
      }),
      { totalHoursWeek: 0, totalHoursMonth: 0 },
    );
  }, [workSummary]);
  const totalIncome = financeSummary?.income ?? 0;
  const totalExpenses = financeSummary?.expenses ?? 0;
  const netBalance = financeSummary?.net ?? 0;

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <StatCard
          label="Horassem"
          value={totalHoursWeek}
          icon={Clock}
          color="var(--color-accent)"
          suffix="h"
        />
        <StatCard
          label="Horasmês"
          value={totalHoursMonth}
          icon={Briefcase}
          color="var(--color-warning)"
          suffix="h"
        />
      </div>

      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <StatCard
          label="Receita"
          value={totalIncome}
          icon={DollarSign}
          color="var(--color-success)"
          suffix="R$"
          format="currency"
        />
        <StatCard
          label="Despesas"
          value={totalExpenses}
          icon={TrendingUp}
          color={totalExpenses > totalIncome ? 'var(--color-danger)' : 'var(--color-warning)'}
          suffix="R$"
          format="currency"
        />
      </div>

      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-[var(--space-3)]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">Saldo do mês</span>
          <span
            className="text-lg font-bold"
            style={{ color: netBalance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
          >
            {netBalance >= 0 ? '+' : ''}
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(netBalance)}
          </span>
        </div>
      </div>

      {workSummary && workSummary.length > 0 && (
        <div className="space-y-[var(--space-1)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Por workspace
          </div>
          {workSummary.slice(0, 3).map((ws) => (
            <div
              key={ws.workspace.id}
              className="flex items-center justify-between text-sm rounded-[var(--radius-sm)] px-2 py-1.5"
            >
              <span className="truncate text-[var(--color-text-primary)]">{ws.workspace.name}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {ws.total_hours_week?.toFixed(1) ?? 0}h sem
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  suffix,
  format,
}: {
  label: string;
  value: number;
  icon: typeof DollarSign;
  color: string;
  suffix?: string;
  format?: 'currency';
}) {
  const displayValue =
    format === 'currency'
      ? new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value)
      : suffix
        ? `${value} ${suffix}`
        : value;

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-[var(--space-3)]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </span>
        <Icon className="h-3 w-3" style={{ color }} />
      </div>
      <span className="text-xl font-bold" style={{ color }}>
        {displayValue}
      </span>
    </div>
  );
}
