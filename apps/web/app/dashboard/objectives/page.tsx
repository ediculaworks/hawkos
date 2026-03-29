'use client';

import { DemandsView } from '@/components/demands/demands-view';
import { AnimatedPage } from '@/components/motion/animated-page';
import { GoalCard } from '@/components/objectives/goal-card';
import { InlineGoalForm } from '@/components/objectives/inline-goal-form';
import { InlineTaskForm } from '@/components/objectives/inline-task-form';
import { KanbanBoard } from '@/components/objectives/kanban-board';
import { ObjectivesHeader, type ObjectivesView } from '@/components/objectives/objectives-header';
import { OverdueBanner } from '@/components/objectives/overdue-banner';
import { ProjectsView } from '@/components/objectives/projects-view';
import { RecentlyCompleted } from '@/components/objectives/recently-completed';
import { TaskSection } from '@/components/objectives/task-section';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton, PageSkeleton } from '@/components/ui/skeleton';
import {
  fetchActiveTasks,
  fetchGoals,
  fetchOverdueTasks,
  setTaskStatus,
} from '@/lib/actions/objectives';
import { todayDateStr } from '@/lib/utils/format';
import type { ObjectiveTimeframe, Task } from '@hawk/module-objectives/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Target } from 'lucide-react';
import { Suspense } from 'react';
import { useEffect, useRef, useState } from 'react';

type View = ObjectivesView;

const TIMEFRAME_LABELS: Record<ObjectiveTimeframe, string> = {
  short: 'Curto prazo',
  medium: 'Médio prazo',
  long: 'Longo prazo',
};

function partitionTasks(tasks: Task[]): { today: Task[]; thisWeek: Task[]; noDate: Task[] } {
  const now = new Date();
  const todayStr = todayDateStr();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const weekEndStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    weekEnd,
  );

  const today: Task[] = [];
  const thisWeek: Task[] = [];
  const noDate: Task[] = [];

  for (const t of tasks) {
    if (t.status === 'in_progress') {
      today.push(t);
    } else if (!t.due_date) {
      noDate.push(t);
    } else if (t.due_date === todayStr) {
      today.push(t);
    } else if (t.due_date <= weekEndStr) {
      thisWeek.push(t);
    } else {
      noDate.push(t);
    }
  }

  return { today, thisWeek, noDate };
}

export default function ObjectivesPage() {
  const [view, setView] = useState<View>('focus');
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showDemandForm, setShowDemandForm] = useState(false);
  const [taskFormKey, setTaskFormKey] = useState(0);
  const taskFormRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isEditable =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

      if ((e.key === 'c' || e.key === 'C') && !isEditable && !e.metaKey && !e.ctrlKey) {
        if (!showTaskForm) {
          setShowTaskForm(true);
          setShowGoalForm(false);
          setTaskFormKey((k) => k + 1);
          setTimeout(() => {
            taskFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
        }
        return;
      }

      if (e.key === 'Escape') {
        setShowTaskForm(false);
        setShowGoalForm(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showTaskForm]);

  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ['objectives', 'goals'],
    queryFn: () => fetchGoals(),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['objectives', 'tasks-active'],
    queryFn: () => fetchActiveTasks(100),
  });

  const { data: overdue } = useQuery({
    queryKey: ['objectives', 'overdue'],
    queryFn: () => fetchOverdueTasks(),
  });

  const completeMutation = useMutation({
    mutationFn: (taskId: string) => setTaskStatus(taskId, 'done'),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['objectives'] });
      const prev = queryClient.getQueryData(['objectives', 'tasks-active']);
      queryClient.setQueryData(['objectives', 'tasks-active'], (old: Task[] | undefined) =>
        old?.filter((t) => t.id !== taskId),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['objectives', 'tasks-active'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['objectives'] }),
  });

  const goalTitles: Record<string, string> = {};
  if (goals) {
    for (const tf of ['short', 'medium', 'long'] as ObjectiveTimeframe[]) {
      for (const g of goals[tf] ?? []) {
        goalTitles[g.id] = g.title;
      }
    }
  }

  const partitioned = tasks ? partitionTasks(tasks) : { today: [], thisWeek: [], noDate: [] };
  const pageLoading = goalsLoading && tasksLoading;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <AnimatedPage className="space-y-[var(--space-5)]">
        <ObjectivesHeader
          view={view}
          onViewChange={setView}
          onAddTask={() => {
            setShowTaskForm(!showTaskForm);
            setShowGoalForm(false);
            if (!showTaskForm) setTaskFormKey((k) => k + 1);
          }}
          onAddGoal={() => {
            setShowGoalForm(!showGoalForm);
            setShowTaskForm(false);
          }}
          onAddDemand={() => setShowDemandForm(!showDemandForm)}
        />

        {!showTaskForm && !showGoalForm && (
          <p className="text-[10px] text-[var(--color-text-muted)] -mt-[var(--space-2)]">
            Pressione <kbd className="bg-[var(--color-surface-3)] px-1 rounded text-[9px]">C</kbd>{' '}
            para adicionar tarefa ·{' '}
            <kbd className="bg-[var(--color-surface-3)] px-1 rounded text-[9px]">Esc</kbd> para
            fechar
          </p>
        )}

        {showGoalForm && <InlineGoalForm onClose={() => setShowGoalForm(false)} />}
        {showTaskForm && (
          <div ref={taskFormRef}>
            <InlineTaskForm key={taskFormKey} autoFocus />
          </div>
        )}

        {view === 'focus' && pageLoading && (
          <div className="space-y-[var(--space-4)]">
            <ListSkeleton items={5} />
          </div>
        )}

        {view === 'focus' && !pageLoading && (
          <div className="space-y-[var(--space-5)]">
            {overdue && <OverdueBanner tasks={overdue} />}

            <TaskSection
              label="Hoje"
              tasks={partitioned.today}
              goalTitles={goalTitles}
              onComplete={(id) => completeMutation.mutate(id)}
              emptyMessage="Sem tarefas para hoje. Adicione uma para organizar seu dia."
            />
            <TaskSection
              label="Esta semana"
              tasks={partitioned.thisWeek}
              goalTitles={goalTitles}
              onComplete={(id) => completeMutation.mutate(id)}
            />
            <TaskSection
              label="Sem data"
              tasks={partitioned.noDate}
              goalTitles={goalTitles}
              onComplete={(id) => completeMutation.mutate(id)}
              defaultCollapsed
            />
            <RecentlyCompleted />
          </div>
        )}

        {view === 'goals' && (
          <div className="space-y-[var(--space-6)]">
            {goals &&
              (['short', 'medium', 'long'] as ObjectiveTimeframe[]).map((tf) => {
                const items = goals[tf];
                if (!items || items.length === 0) return null;
                return (
                  <div key={tf}>
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-3)] block">
                      {TIMEFRAME_LABELS[tf]}
                    </span>
                    <div className="space-y-[var(--space-2)]">
                      {items.map((goal) => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          onTaskComplete={(id) => completeMutation.mutate(id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            {goals && !goals.short?.length && !goals.medium?.length && !goals.long?.length && (
              <div className="py-[var(--space-4)]">
                <EmptyState
                  icon={Target}
                  title="Nenhuma meta definida"
                  description="Metas dão direção ao esforço diário. Crie sua primeira meta."
                />
              </div>
            )}
          </div>
        )}

        {view === 'projects' && <ProjectsView />}

        {view === 'board' && <KanbanBoard />}

        {view === 'demands' && (
          <DemandsView
            showCreateForm={showDemandForm}
            onCloseCreateForm={() => setShowDemandForm(false)}
          />
        )}
      </AnimatedPage>
    </Suspense>
  );
}
