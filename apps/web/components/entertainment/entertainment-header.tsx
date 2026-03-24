'use client';

import { Button } from '@/components/ui/button';
import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import { Film, Gamepad2, Plus } from 'lucide-react';

export type EntertainmentTab = 'today' | 'media' | 'hobbies';

interface EntertainmentHeaderProps {
  activeTab: EntertainmentTab;
  onTabChange: (tab: EntertainmentTab) => void;
  onAddMedia?: () => void;
  onAddHobby?: () => void;
}

const tabs: TabItem<EntertainmentTab>[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'media', label: 'Mídia' },
  { id: 'hobbies', label: 'Hobbies' },
];

export function EntertainmentHeader({
  activeTab,
  onTabChange,
  onAddMedia,
  onAddHobby,
}: EntertainmentHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-1)]">
          <Film className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Entretenimento</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Filmes, séries, jogos e hobbies</p>
        </div>
      </div>

      <div className="flex items-center gap-[var(--space-2)]">
        {onAddMedia && (
          <Button size="sm" variant="ghost" onClick={onAddMedia}>
            <Plus className="h-3.5 w-3.5" /> Mídia
          </Button>
        )}
        {onAddHobby && (
          <Button size="sm" variant="ghost" onClick={onAddHobby}>
            <Gamepad2 className="h-3.5 w-3.5" /> Hobby
          </Button>
        )}
        <TabBar tabs={tabs} active={activeTab} onChange={onTabChange} />
      </div>
    </div>
  );
}
