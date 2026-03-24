'use client';

import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import { Sparkles } from 'lucide-react';

export type SpiritualityTab = 'today' | 'timeline' | 'values';

interface SpiritualityHeaderProps {
  activeTab: SpiritualityTab;
  onTabChange: (tab: SpiritualityTab) => void;
}

const tabs: TabItem<SpiritualityTab>[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'values', label: 'Valores' },
];

export function SpiritualityHeader({ activeTab, onTabChange }: SpiritualityHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-1)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Espiritualidade</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Reflexões, gratidão e propósito</p>
        </div>
      </div>

      <TabBar tabs={tabs} active={activeTab} onChange={onTabChange} />
    </div>
  );
}
