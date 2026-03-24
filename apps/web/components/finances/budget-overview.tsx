'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { fetchBudgetStatus, upsertBudgetAction } from '@/lib/actions/finances';
import { formatCurrency } from '@/lib/utils/format';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';

type Props = {
  month: string; // YYYY-MM
};

type BudgetVsActual = {
  budget_id: string;
  category_id: string;
  category_name: string;
  category_type: string;
  month: string;
  budgeted_amount: number;
  carryover_amount: number;
  available_amount: number;
  spent_amount: number;
  remaining_amount: number;
};

function BudgetRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3">
      <Skeleton className="h-4 w-4 flex-shrink-0" />
      <Skeleton className="h-3 w-28 flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <Skeleton className="h-3 w-24 flex-shrink-0" />
    </div>
  );
}

function EditBudgetInline({
  categoryId,
  month,
  current,
  onDone,
}: {
  categoryId: string;
  month: string;
  current: number;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number.parseFloat(value.replace(',', '.'));
    if (Number.isNaN(n) || n < 0) return;
    setSaving(true);
    try {
      await upsertBudgetAction(categoryId, month, n);
      await qc.invalidateQueries({ queryKey: ['finances', 'budget'] });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-[var(--color-text-muted)]">R$</span>
      <input
        type="number"
        min="0"
        step="10"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onDone();
        }}
        className="w-20 text-xs bg-[var(--color-surface-3)] border border-[var(--color-accent)]/50 rounded px-1.5 py-0.5 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        // biome-ignore lint/a11y/noAutofocus: inline edit needs focus
        autoFocus
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="p-0.5 text-green-400 hover:text-green-300 cursor-pointer disabled:opacity-50"
        title="Salvar"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onDone}
        className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
        title="Cancelar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CategoryBudgetRow({ item, month }: { item: BudgetVsActual; month: string }) {
  const [editing, setEditing] = useState(false);

  const spent = item.spent_amount;
  const budget = item.available_amount; // includes carryover
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : spent > 0 ? 100 : 0;
  const over = item.remaining_amount < 0;
  const overAmount = Math.abs(item.remaining_amount);

  return (
    <div className="group flex items-center gap-3 py-2.5 px-3 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-2)]/60 transition-colors">
      {/* Category name */}
      <span
        className="text-sm text-[var(--color-text-secondary)] w-28 truncate flex-shrink-0"
        title={item.category_name}
      >
        {item.category_name}
      </span>

      {/* Progress bar */}
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden min-w-0">
        <div
          className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Amounts / edit */}
      <div className="flex-shrink-0 text-right min-w-[120px]">
        {editing ? (
          <EditBudgetInline
            categoryId={item.category_id}
            month={month}
            current={item.budgeted_amount}
            onDone={() => setEditing(false)}
          />
        ) : (
          <div className="flex items-center justify-end gap-1">
            <span className="text-xs font-mono text-[var(--color-text-secondary)]">
              {formatCurrency(spent)}
              <span className="text-[var(--color-text-muted)]"> / {formatCurrency(budget)}</span>
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-opacity"
              title="Editar orçamento"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0 w-28 text-right">
        {over ? (
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-red-500/15 text-red-400">
            +{formatCurrency(overAmount)}
          </span>
        ) : (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {formatCurrency(item.remaining_amount)} restante
          </span>
        )}
      </div>
    </div>
  );
}

export function BudgetOverview({ month }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['finances', 'budget', month],
    queryFn: () => fetchBudgetStatus(month),
  });

  const items = data ?? [];
  const totalBudget = items.reduce((s, i) => s + i.available_amount, 0);
  const totalSpent = items.reduce((s, i) => s + i.spent_amount, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overCount = items.filter((i) => i.remaining_amount < 0).length;

  if (isLoading) {
    return (
      <div className="space-y-1">
        {/* Header skeleton */}
        <div className="flex gap-6 px-3 py-3 mb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-2 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton list
          <BudgetRowSkeleton key={`budget-sk-${i}`} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          Sem orçamento configurado para este mês.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Passe o mouse sobre uma categoria e clique no lápis para definir um valor.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary header */}
      <div className="flex items-center gap-6 px-3 py-3 mb-1 border-b border-[var(--color-border-subtle)]">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
            Orçado
          </p>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {formatCurrency(totalBudget)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
            Gasto
          </p>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {formatCurrency(totalSpent)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
            Restante
          </p>
          <p
            className={`text-sm font-semibold ${totalRemaining < 0 ? 'text-red-400' : 'text-green-400'}`}
          >
            {formatCurrency(totalRemaining)}
          </p>
        </div>
        {overCount > 0 && (
          <div className="ml-auto">
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-500/15 text-red-400">
              {overCount} acima do limite
            </span>
          </div>
        )}
      </div>

      {/* Category rows */}
      <div className="divide-y divide-[var(--color-border-subtle)]/30">
        {items.map((item) => (
          <CategoryBudgetRow key={item.budget_id} item={item} month={month} />
        ))}
      </div>
    </div>
  );
}
