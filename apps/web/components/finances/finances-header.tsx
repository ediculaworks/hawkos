'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

type Props = {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
};

export function FinancesHeader({ month, onPrev, onNext }: Props) {
  const label = `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;
  const isCurrentMonth =
    month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear();

  return (
    <div className="flex items-center gap-[var(--space-3)]">
      <button
        type="button"
        onClick={onPrev}
        title="Mês anterior"
        className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-semibold text-[var(--color-text-primary)] min-w-[140px] text-center">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={isCurrentMonth}
        title="Próximo mês"
        className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
