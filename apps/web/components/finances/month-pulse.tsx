'use client';

import { formatCurrency } from '@/lib/utils/format';
import type { FinanceSummary } from '@hawk/module-finances/types';

type Props = {
  current: FinanceSummary;
  previous: FinanceSummary | null;
  month: Date;
};

export function MonthPulse({ current, previous, month }: Props) {
  const today = new Date();
  const isCurrentMonth =
    month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();

  const dayOfMonth = isCurrentMonth
    ? today.getDate()
    : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const daysLeft = isCurrentMonth ? daysInMonth - dayOfMonth : 0;

  const velocity = dayOfMonth > 0 ? current.expenses / dayOfMonth : 0;
  const projected = velocity * daysInMonth;

  const prevVelocity =
    previous && previous.expenses > 0
      ? previous.expenses / new Date(month.getFullYear(), month.getMonth(), 0).getDate()
      : null;
  const velocityDelta = prevVelocity ? ((velocity - prevVelocity) / prevVelocity) * 100 : null;

  return (
    <div className="space-y-[var(--space-3)]">
      <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        Pulso do mês
      </span>

      <div className="space-y-[var(--space-2)]">
        <PulseRow label="Gasto até agora" value={formatCurrency(current.expenses)} />
        <PulseRow
          label="Velocidade"
          value={`${formatCurrency(velocity)}/dia`}
          delta={velocityDelta}
        />
        {isCurrentMonth && <PulseRow label="Dias restantes" value={`${daysLeft}`} />}
        <PulseRow
          label="Projeção"
          value={formatCurrency(projected)}
          highlight={projected > (previous?.expenses ?? projected)}
        />
      </div>
    </div>
  );
}

function PulseRow({
  label,
  value,
  delta,
  highlight,
}: {
  label: string;
  value: string;
  delta?: number | null;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-[var(--color-text-muted)]">{label}</span>
      <div className="flex items-baseline gap-[var(--space-1)]">
        <span
          className="text-xs font-mono"
          style={{ color: highlight ? 'var(--color-danger)' : 'var(--color-text-primary)' }}
        >
          {value}
        </span>
        {delta !== null && delta !== undefined && (
          <span
            className="text-[10px]"
            style={{ color: delta > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}
          >
            {delta > 0 ? '↑' : '↓'}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
