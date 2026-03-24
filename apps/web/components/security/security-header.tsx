'use client';

import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import { Shield } from 'lucide-react';

export type SecurityTab = 'today' | 'all';

interface SecurityHeaderProps {
  activeTab: SecurityTab;
  onTabChange: (tab: SecurityTab) => void;
}

const tabs: TabItem<SecurityTab>[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'all', label: 'Todos' },
];

export function SecurityHeader({ activeTab, onTabChange }: SecurityHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-1)]">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Segurança</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Checklist de segurança digital e física
          </p>
        </div>
      </div>

      <TabBar tabs={tabs} active={activeTab} onChange={onTabChange} />
    </div>
  );
}
