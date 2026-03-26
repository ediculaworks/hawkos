'use client';

import { AccountManager } from '@/components/finances/account-manager';
import { BudgetOverview } from '@/components/finances/budget-overview';
import { FinancesHeader } from '@/components/finances/finances-header';
import { PortfolioOverview } from '@/components/finances/portfolio-overview';
import { QuickAddTransaction } from '@/components/finances/quick-add-transaction';
import { AnimatedPage } from '@/components/motion/animated-page';
import { TabBar as TabBarComponent, type TabItem } from '@/components/ui/tab-bar';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

const TransacoesTab = dynamic(() => import('./tabs/transacoes-tab'), { ssr: false });

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
  const showMonthNav = activeTab !== 'portfolio';

  return (
    <AnimatedPage>
      <div className="mb-[var(--space-4)] flex items-center justify-between gap-4">
        {showMonthNav ? (
          <FinancesHeader month={month} onPrev={prevMonth} onNext={nextMonth} />
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={toggleQuickAdd}
          className="px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          + Transação
        </button>
      </div>

      {showQuickAdd && (
        <div className="mb-[var(--space-4)]">
          <QuickAddTransaction expanded={showQuickAdd} onToggle={toggleQuickAdd} />
        </div>
      )}

      <div className="mb-[var(--space-4)]">
        <TabBarComponent
          tabs={TABS}
          active={activeTab}
          onChange={handleTabChange}
          variant="underline"
        />
      </div>

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
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-6 space-y-3"
              >
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-surface-3)]" />
                <div className="h-8 w-32 animate-pulse rounded bg-[var(--color-surface-3)]" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <FinancesContent />
    </Suspense>
  );
}
