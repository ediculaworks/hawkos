'use client';

import { AccountManager } from '@/components/finances/account-manager';
import { CashFlowBar } from '@/components/finances/cash-flow-bar';
import { CategoryBreakdown } from '@/components/finances/category-breakdown';
import { MonthPulse } from '@/components/finances/month-pulse';
import { TransactionFeed } from '@/components/finances/transaction-feed';
import { UpcomingBills } from '@/components/finances/upcoming-bills';
import {
  fetchCategoryBreakdown,
  fetchMonthComparison,
  fetchTransactionsWithCat,
  fetchUpcomingRecurring,
} from '@/lib/actions/finances';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';

export default function TransacoesTab({
  month,
  startDate,
  endDate,
  categoryFilter,
  searchQuery,
  categories,
  setCategoryUrl,
  setSearchUrl,
}: {
  month: Date;
  startDate: string;
  endDate: string;
  categoryFilter: string | null;
  searchQuery: string;
  categories: { category_id: string; name: string }[] | undefined;
  setCategoryUrl: (cat: string | null) => void;
  setSearchUrl: (q: string) => void;
}) {
  const { data: comparison } = useQuery({
    queryKey: ['finances', 'comparison', startDate],
    queryFn: () => fetchMonthComparison(),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['finances', 'category-breakdown', startDate],
    queryFn: () => fetchCategoryBreakdown(startDate, endDate),
  });

  const { data: transactionsResult } = useQuery({
    queryKey: ['finances', 'transactions-with-cat', startDate, categoryFilter],
    queryFn: () =>
      fetchTransactionsWithCat(undefined, startDate, endDate, categoryFilter ?? undefined, 100),
  });
  const transactions = transactionsResult?.data;

  const { data: upcoming } = useQuery({
    queryKey: ['finances', 'upcoming'],
    queryFn: () => fetchUpcomingRecurring(7),
  });

  const filteredTransactions = searchQuery.trim()
    ? (transactions ?? []).filter(
        (t) =>
          t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.category_name?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : (transactions ?? []);

  const resolvedCategories = categoriesData ?? categories ?? [];

  return (
    <div className="flex gap-[var(--space-6)] items-start mt-[var(--space-6)]">
      <div className="flex-1 min-w-0 space-y-[var(--space-6)]">
        {comparison && <CashFlowBar current={comparison.current} previous={comparison.previous} />}

        {categoriesData && (
          <CategoryBreakdown
            categories={categoriesData}
            selectedCategoryId={categoryFilter}
            onSelect={setCategoryUrl}
          />
        )}

        <div className="space-y-[var(--space-3)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchUrl(e.target.value)}
              placeholder="Buscar transações..."
              className="w-full pl-10 pr-10 py-[var(--space-2)] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchUrl('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {(categoryFilter || searchQuery) && (
            <div className="flex items-center gap-[var(--space-2)]">
              <span className="text-xs text-[var(--color-text-muted)]">Filtros ativos:</span>
              {categoryFilter && (
                <button
                  type="button"
                  onClick={() => setCategoryUrl(null)}
                  className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30 cursor-pointer"
                >
                  {resolvedCategories.find((c) => c.category_id === categoryFilter)?.name ??
                    categoryFilter}{' '}
                  ×
                </button>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchUrl('')}
                  className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] cursor-pointer"
                >
                  "{searchQuery}" ×
                </button>
              )}
            </div>
          )}

          <TransactionFeed transactions={filteredTransactions} />
        </div>
      </div>

      <div className="w-64 flex-shrink-0 space-y-[var(--space-6)] hidden lg:block">
        {comparison && (
          <MonthPulse current={comparison.current} previous={comparison.previous} month={month} />
        )}
        <AccountManager />
        {upcoming && <UpcomingBills recurring={upcoming} />}
      </div>
    </div>
  );
}
