'use client';

import { cn } from '@/lib/utils/cn';

type Tab = 'today' | 'week' | 'history';

interface HealthHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  date?: Date;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'history', label: 'Histórico' },
];

export function HealthHeader({ activeTab, onTabChange }: HealthHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Saúde</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Acompanhe sua saúde e bem-estar</p>
      </div>
      <div className="flex gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--color-surface-2)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer',
              activeTab === tab.id
                ? 'bg-[var(--color-surface-0)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
