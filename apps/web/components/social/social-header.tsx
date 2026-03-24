'use client';

import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import { Share2 } from 'lucide-react';

export type SocialTab = 'posts' | 'kanban' | 'create' | 'goals';

interface SocialHeaderProps {
  activeTab: SocialTab;
  onTabChange: (tab: SocialTab) => void;
}

const tabs: TabItem<SocialTab>[] = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'posts', label: 'Posts' },
  { id: 'create', label: 'Criar' },
  { id: 'goals', label: 'Metas' },
];

export function SocialHeader({ activeTab, onTabChange }: SocialHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-1)]">
          <Share2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Social</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Presença digital e métricas</p>
        </div>
      </div>

      <TabBar tabs={tabs} active={activeTab} onChange={onTabChange} />
    </div>
  );
}
