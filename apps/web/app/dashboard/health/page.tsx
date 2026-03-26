'use client';

import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

type Tab = 'today' | 'week' | 'history' | 'treinos';
type DateRange = '7d' | '14d' | '30d' | '90d';

const TodayTab = dynamic(() => import('./tabs/today-tab'), { ssr: false });
const WeekTab = dynamic(() => import('./tabs/week-tab'), { ssr: false });
const HistoryTab = dynamic(() => import('./tabs/history-tab'), { ssr: false });
const TreinosTab = dynamic(() => import('./tabs/treinos-tab'), { ssr: false });

const HEALTH_TABS: TabItem<Tab>[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'history', label: 'Histórico' },
  { id: 'treinos', label: 'Treinos' },
];

const RANGE_TABS: TabItem<DateRange>[] = [
  { id: '7d', label: '7d' },
  { id: '14d', label: '14d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '3m' },
];

export default function HealthPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-[var(--space-6)]">
          <div className="h-16 animate-pulse bg-[var(--color-surface-2)] rounded-lg" />
        </div>
      }
    >
      <HealthPageInner />
    </Suspense>
  );
}

function HealthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab =
    tabParam && ['today', 'week', 'history', 'treinos'].includes(tabParam) ? tabParam : 'today';

  const rangeParam = searchParams.get('range') as DateRange | null;
  const dateRange: DateRange =
    rangeParam && ['7d', '14d', '30d', '90d'].includes(rangeParam) ? rangeParam : '14d';

  const setTab = (tab: Tab) => {
    router.push(`/dashboard/health?tab=${tab}&range=${dateRange}`, { scroll: false });
  };

  const setDateRange = (range: DateRange) => {
    router.push(`/dashboard/health?tab=${activeTab}&range=${range}`, { scroll: false });
  };

  return (
    <div className="space-y-[var(--space-6)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Saúde</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Acompanhe sua saúde e bem-estar</p>
        </div>
        <div className="flex gap-3">
          {activeTab !== 'today' && (
            <TabBar tabs={RANGE_TABS} active={dateRange} onChange={setDateRange} size="sm" />
          )}
          <TabBar tabs={HEALTH_TABS} active={activeTab} onChange={setTab} />
        </div>
      </div>

      {activeTab === 'today' && <TodayTab />}
      {activeTab === 'week' && <WeekTab dateRange={dateRange} />}
      {activeTab === 'history' && <HistoryTab dateRange={dateRange} />}
      {activeTab === 'treinos' && <TreinosTab />}
    </div>
  );
}
