'use client';

import { Button } from '@/components/ui/button';
import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import { Briefcase, Kanban, ListChecks, Plus, Rocket, Target } from 'lucide-react';

export type ObjectivesView = 'focus' | 'goals' | 'projects' | 'board' | 'demands';

type Props = {
  view: ObjectivesView;
  onViewChange: (v: ObjectivesView) => void;
  onAddTask: () => void;
  onAddGoal: () => void;
  onAddDemand?: () => void;
};

const tabs: TabItem<ObjectivesView>[] = [
  { id: 'focus', label: 'Foco', icon: ListChecks },
  { id: 'goals', label: 'Metas', icon: Target },
  { id: 'projects', label: 'Projetos', icon: Briefcase },
  { id: 'board', label: 'Board', icon: Kanban },
  { id: 'demands', label: 'Demandas', icon: Rocket },
];

export function ObjectivesHeader({ view, onViewChange, onAddTask, onAddGoal, onAddDemand }: Props) {
  return (
    <div className="flex items-center justify-between">
      <TabBar tabs={tabs} active={view} onChange={onViewChange} size="sm" />
      <div className="flex gap-[var(--space-2)]">
        {view === 'demands' ? (
          <Button size="sm" onClick={onAddDemand}>
            <Rocket className="h-3.5 w-3.5" /> Demanda
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={onAddTask}>
              <Plus className="h-3.5 w-3.5" /> Tarefa
            </Button>
            <Button size="sm" onClick={onAddGoal}>
              <Target className="h-3.5 w-3.5" /> Meta
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
