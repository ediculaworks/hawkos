'use client';

import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import { Home } from 'lucide-react';

export type HousingTab = 'today' | 'bills' | 'maintenance';

interface HousingHeaderProps {
  activeTab: HousingTab;
  onTabChange: (tab: HousingTab) => void;
}

const tabs: TabItem<HousingTab>[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'bills', label: 'Contas' },
  { id: 'maintenance', label: 'Manutenção' },
];

export function HousingHeader({ activeTab, onTabChange }: HousingHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-1)]">
          <Home className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Moradia</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Contas, manutenção e residências</p>
        </div>
      </div>

      <TabBar tabs={tabs} active={activeTab} onChange={onTabChange} />
    </div>
  );
}
