'use client';

import { fetchFinanceSummary } from '@/lib/actions/finances';
import { fetchMonthlyBillTotal, fetchPendingBills, payBill } from '@/lib/actions/housing';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, CreditCard, Home } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BillsWidget() {
  const queryClient = useQueryClient();

  const payMutation = useMutation({
    mutationFn: (id: string) => payBill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housing'] });
      toast.success('Conta marcada como paga');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const { data: pendingBills } = useQuery({
    queryKey: ['housing', 'pending-bills'],
    queryFn: () => fetchPendingBills(),
  });

  const { data: monthlyTotal } = useQuery({
    queryKey: ['housing', 'monthly-total'],
    queryFn: () => fetchMonthlyBillTotal(),
  });

  const { data: financeSummary } = useQuery({
    queryKey: ['finances', 'summary'],
    queryFn: () => fetchFinanceSummary(),
  });

  const pendingCount = pendingBills?.length ?? 0;
  const monthlyHousing = monthlyTotal ?? 0;
  const expenses = financeSummary?.expenses ?? 0;
  const housingPercentage = expenses > 0 ? (monthlyHousing / expenses) * 100 : 0;

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <StatCard
          label="Pendentes"
          value={pendingCount}
          icon={AlertCircle}
          color={pendingCount > 0 ? 'var(--color-warning)' : 'var(--color-success)'}
        />
        <StatCard
          label="Total mês"
          value={monthlyHousing}
          icon={Home}
          color="var(--color-accent)"
          format="currency"
        />
      </div>

      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-[var(--space-3)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--color-text-muted)]">% das despesas</span>
          <span className="text-sm font-bold text-[var(--color-text-primary)]">
            {housingPercentage.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-[var(--duration-slow)]"
            style={{
              width: `${Math.min(housingPercentage, 100)}%`,
              background:
                housingPercentage > 50
                  ? 'var(--color-danger)'
                  : housingPercentage > 30
                    ? 'var(--color-warning)'
                    : 'var(--color-success)',
            }}
          />
        </div>
      </div>

      {pendingBills && pendingBills.length > 0 && (
        <div className="space-y-[var(--space-1)]">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            <CreditCard className="h-3 w-3" />
            Pagar em breve
          </div>
          {pendingBills.slice(0, 4).map((bill) => (
            <div
              key={bill.id}
              className="group flex items-center justify-between text-sm rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
            >
              <span className="truncate text-[var(--color-text-primary)]">{bill.name}</span>
              <div className="flex items-center gap-[var(--space-2)]">
                <span className="text-[10px] text-[var(--color-warning)]">
                  {bill.amount
                    ? new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(bill.amount)
                    : '-'}
                </span>
                <button
                  type="button"
                  onClick={() => payMutation.mutate(bill.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--color-success)] hover:bg-[var(--color-success-muted)] rounded transition-all cursor-pointer"
                  title="Marcar como pago"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingCount === 0 && (
        <div className="text-center text-sm text-[var(--color-text-muted)] py-2">
          Nenhuma conta pendente
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
  format,
}: {
  label: string;
  value: number;
  icon: typeof AlertCircle;
  color: string;
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
