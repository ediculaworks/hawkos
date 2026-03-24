'use client';

import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatPercent } from '@/lib/utils/format';
import type { CategorySpending } from '@hawk/module-finances/types';

type Props = {
  categories: CategorySpending[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
};

export function CategoryBreakdown({ categories, selectedCategoryId, onSelect }: Props) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-[var(--space-4)]">
        Sem despesas para categorizar
      </p>
    );
  }

  const maxTotal = categories[0]?.total ?? 1;

  return (
    <div className="space-y-[var(--space-1-5)]">
      <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        Categorias
      </span>
      {categories.slice(0, 8).map((cat) => {
        const isSelected = selectedCategoryId === cat.category_id;
        return (
          <button
            key={cat.category_id}
            type="button"
            onClick={() => onSelect(isSelected ? null : cat.category_id)}
            className={cn(
              'flex w-full items-center gap-[var(--space-3)] py-[var(--space-1-5)] px-[var(--space-2)] rounded-[var(--radius-md)] transition-colors cursor-pointer text-left',
              isSelected ? 'bg-[var(--color-surface-2)]' : 'hover:bg-[var(--color-surface-2)]/50',
            )}
          >
            <span className="text-sm w-5 flex-shrink-0 text-center">{cat.icon ?? '•'}</span>
            <span className="text-sm text-[var(--color-text-secondary)] w-24 truncate flex-shrink-0">
              {cat.name}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(cat.total / maxTotal) * 100}%`,
                  background: cat.color ?? 'var(--color-accent)',
                }}
              />
            </div>
            <span className="text-xs font-mono text-[var(--color-text-primary)] w-20 text-right flex-shrink-0">
              {formatCurrency(cat.total)}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)] w-8 text-right flex-shrink-0">
              {formatPercent(cat.percentage)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
