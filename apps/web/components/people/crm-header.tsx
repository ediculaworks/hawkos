'use client';

import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import { Focus, List, Network, UserPlus } from 'lucide-react';

export type CrmView = 'focus' | 'network' | 'all';

type Props = {
  view: CrmView;
  onViewChange: (v: CrmView) => void;
  onAddPerson?: () => void;
};

const tabs: TabItem<CrmView>[] = [
  { id: 'focus', label: 'Foco', icon: Focus },
  { id: 'network', label: 'Rede', icon: Network },
  { id: 'all', label: 'Todos', icon: List },
];

export function CrmHeader({ view, onViewChange, onAddPerson }: Props) {
  return (
    <div className="flex items-center justify-between">
      <TabBar tabs={tabs} active={view} onChange={onViewChange} size="sm" />
      {onAddPerson && (
        <button
          type="button"
          onClick={onAddPerson}
          className="flex items-center gap-[var(--space-1-5)] px-[var(--space-3)] py-[var(--space-1-5)] rounded-[var(--radius-md)] text-xs font-medium text-[var(--color-mod-people)] bg-[var(--color-mod-people)]/10 hover:bg-[var(--color-mod-people)]/20 transition-colors cursor-pointer"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Contato
        </button>
      )}
    </div>
  );
}
