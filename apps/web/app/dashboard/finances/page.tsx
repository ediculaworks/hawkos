'use client';

import { AccountManager } from '@/components/finances/account-manager';
import { BudgetOverview } from '@/components/finances/budget-overview';
import { CashFlowBar } from '@/components/finances/cash-flow-bar';
import { CategoryBreakdown } from '@/components/finances/category-breakdown';
import { FinancesHeader } from '@/components/finances/finances-header';
import { MonthPulse } from '@/components/finances/month-pulse';
import { PortfolioOverview } from '@/components/finances/portfolio-overview';
import { QuickAddTransaction } from '@/components/finances/quick-add-transaction';
import { TransactionFeed } from '@/components/finances/transaction-feed';
import { UpcomingBills } from '@/components/finances/upcoming-bills';
import { AnimatedPage } from '@/components/motion/animated-page';
import { TabBar as TabBarComponent, type TabItem } from '@/components/ui/tab-bar';
import {
  fetchCategoryBreakdown,
  fetchMonthComparison,
  fetchTransactionsWithCat,
  fetchUpcomingRecurring,
} from '@/lib/actions/finances';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

function getMonthStart(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function getMonthEnd(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function getMonthFromParam(monthStr: string | null): Date {
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const parts = monthStr.split('-').map(Number);
    const year = parts[0] as number;
    const month = parts[1] as number;
    if (!Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12) {
      return new Date(year, month - 1, 1);
    }
  }
  return new Date();
}

type Tab = 'transacoes' | 'orcamento' | 'portfolio';

const TABS: TabItem<Tab>[] = [
  { id: 'transacoes', label: 'Transações' },
  { id: 'orcamento', label: 'Orçamento' },
  { id: 'portfolio', label: 'Portfólio' },
];

function TransacoesTab({
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
      {/* Main column */}
      <div className="flex-1 min-w-0 space-y-[var(--space-6)]">
        {/* Cash flow */}
        {comparison && <CashFlowBar current={comparison.current} previous={comparison.previous} />}

        {/* Category breakdown */}
        {categoriesData && (
          <CategoryBreakdown
            categories={categoriesData}
            selectedCategoryId={categoryFilter}
            onSelect={setCategoryUrl}
          />
        )}

        {/* Search + Transaction feed */}
        <div className="space-y-[var(--space-3)]">
          {/* Search bar */}
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

          {/* Active filters */}
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

      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 space-y-[var(--space-6)] hidden lg:block">
        {/* Month pulse */}
        {comparison && (
          <MonthPulse current={comparison.current} previous={comparison.previous} month={month} />
        )}

        {/* Accounts */}
        <AccountManager />

        {/* Upcoming bills */}
        {upcoming && <UpcomingBills recurring={upcoming} />}
      </div>
    </div>
  );
}

function FinancesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthParam = searchParams.get('month');
  const categoryParam = searchParams.get('category');
  const searchParam = searchParams.get('q');
  const actionParam = searchParams.get('action');
  const tabParam = searchParams.get('tab') as Tab | null;

  const [month, setMonth] = useState(() => getMonthFromParam(monthParam));
  const [categoryFilter, setCategoryFilter] = useState<string | null>(categoryParam);
  const [searchQuery, setSearchQuery] = useState(searchParam ?? '');
  const [showQuickAdd, setShowQuickAdd] = useState(actionParam === 'new');
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'transacoes',
  );

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.push(`/dashboard/finances?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const setMonthUrl = useCallback(
    (d: Date) => {
      setMonth(d);
      updateParams({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
    },
    [updateParams],
  );

  const setCategoryUrl = useCallback(
    (cat: string | null) => {
      setCategoryFilter(cat);
      updateParams({ category: cat });
    },
    [updateParams],
  );

  const setSearchUrl = useCallback(
    (q: string) => {
      setSearchQuery(q);
      updateParams({ q: q || null });
    },
    [updateParams],
  );

  const handleTabChange = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      updateParams({ tab: tab === 'transacoes' ? null : tab });
    },
    [updateParams],
  );

  const prevMonth = () => {
    const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    setMonthUrl(prev);
  };

  const nextMonth = () => {
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    setMonthUrl(next);
  };

  const toggleQuickAdd = () => {
    const next = !showQuickAdd;
    setShowQuickAdd(next);
    updateParams({ action: next ? 'new' : null });
  };

  useEffect(() => {
    if (monthParam) {
      const d = getMonthFromParam(monthParam);
      setMonth(d);
    }
  }, [monthParam]);

  useEffect(() => {
    if (categoryParam !== null) {
      setCategoryFilter(categoryParam);
    }
  }, [categoryParam]);

  useEffect(() => {
    setSearchQuery(searchParam ?? '');
  }, [searchParam]);

  const startDate = getMonthStart(month);
  const endDate = getMonthEnd(month);
  const selectedMonth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

  // Portfolio tab never needs month nav — hide it there
  const showMonthNav = activeTab !== 'portfolio';

  return (
    <AnimatedPage>
      {/* Header row */}
      <div className="mb-[var(--space-4)] flex items-center justify-between gap-4">
        {showMonthNav ? (
          <FinancesHeader month={month} onPrev={prevMonth} onNext={nextMonth} />
        ) : (
          <div /> /* spacer so quick-add stays right */
        )}

        {/* Quick add button — always visible */}
        <button
          type="button"
          onClick={toggleQuickAdd}
          className="px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          + Transação
        </button>
      </div>

      {/* Quick add panel */}
      {showQuickAdd && (
        <div className="mb-[var(--space-4)]">
          <QuickAddTransaction expanded={showQuickAdd} onToggle={toggleQuickAdd} />
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-[var(--space-4)]">
        <TabBarComponent
          tabs={TABS}
          active={activeTab}
          onChange={handleTabChange}
          variant="underline"
        />
      </div>

      {/* Tab content */}
      {activeTab === 'transacoes' && (
        <TransacoesTab
          month={month}
          startDate={startDate}
          endDate={endDate}
          categoryFilter={categoryFilter}
          searchQuery={searchQuery}
          categories={undefined}
          setCategoryUrl={setCategoryUrl}
          setSearchUrl={setSearchUrl}
        />
      )}

      {activeTab === 'orcamento' && (
        <div className="flex gap-[var(--space-6)] items-start">
          <div className="flex-1 min-w-0 bg-[var(--color-surface-1)] rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)]">
            <BudgetOverview month={selectedMonth} />
          </div>
          {/* Sidebar — accounts + upcoming */}
          <div className="w-64 flex-shrink-0 space-y-[var(--space-6)] hidden lg:block">
            <AccountManager />
          </div>
        </div>
      )}

      {activeTab === 'portfolio' && (
        <div className="bg-[var(--color-surface-1)] rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)]">
          <PortfolioOverview />
        </div>
      )}
    </AnimatedPage>
  );
}

export default function FinancesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-[var(--space-5)]">
          <div className="h-8 w-48 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-3)]" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--space-4)]">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-6 space-y-3">
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-surface-3)]" />
              <div className="h-8 w-32 animate-pulse rounded bg-[var(--color-surface-3)]" />
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-6 space-y-3">
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-surface-3)]" />
              <div className="h-8 w-32 animate-pulse rounded bg-[var(--color-surface-3)]" />
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-6 space-y-3">
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-surface-3)]" />
              <div className="h-8 w-32 animate-pulse rounded bg-[var(--color-surface-3)]" />
            </div>
          </div>
        </div>
      }
    >
      <FinancesContent />
    </Suspense>
  );
}
