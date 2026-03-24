'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  fetchActiveCycle,
  fetchTasksByState,
  updateTaskStateAction,
} from '@/lib/actions/objectives';
import { cn } from '@/lib/utils/cn';
import { todayDateStr } from '@/lib/utils/format';
import type { Cycle, IssueState, Task } from '@hawk/module-objectives/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Calendar, ChevronRight, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const STATE_TYPE_COLORS: Record<string, string> = {
  backlog: 'bg-slate-400',
  unstarted: 'bg-gray-400',
  started: 'bg-blue-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-400',
};

function CycleBar({ cycle }: { cycle: Cycle }) {
  const start = new Date(cycle.start_date);
  const end = new Date(cycle.end_date);
  const now = new Date();
  const total = end.getTime() - start.getTime();
  const elapsed = Math.min(now.getTime() - start.getTime(), total);
  const pct = total > 0 ? Math.round((elapsed / total) * 100) : 0;

  return (
    <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{cycle.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} →{' '}
            {end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </span>
          {cycle.velocity_estimate && (
            <span className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Meta: {cycle.velocity_estimate} tarefas
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{pct}% do tempo decorrido</p>
    </div>
  );
}

function TaskCard({
  task,
  states,
  onMoveState,
}: {
  task: Task;
  states: IssueState[];
  onMoveState: (taskId: string, stateId: string) => void;
}) {
  const isOverdue = task.due_date && task.due_date < todayDateStr();

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5 mb-2 hover:border-[var(--color-accent-primary)]/40 transition-colors group">
      <p className="text-xs font-medium text-[var(--color-text-primary)] line-clamp-2 mb-1.5">
        {task.title}
      </p>
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <div className="flex items-center gap-1">
          {task.priority && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-medium',
                PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium,
              )}
            >
              {task.priority}
            </span>
          )}
          {isOverdue && (
            <span className="flex items-center gap-0.5 text-[10px] text-rose-500">
              <AlertCircle className="h-2.5 w-2.5" />
              {task.due_date
                ? new Date(task.due_date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  })
                : ''}
            </span>
          )}
          {!isOverdue && task.due_date && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {new Date(task.due_date).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
              })}
            </span>
          )}
        </div>
        {/* Move to state selector */}
        <select
          className="text-[10px] bg-transparent text-[var(--color-text-muted)] border-none outline-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity max-w-[80px]"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              onMoveState(task.id, e.target.value);
              e.target.value = '';
            }
          }}
        >
          <option value="" disabled>
            Mover…
          </option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function KanbanColumn({
  state,
  tasks,
  allStates,
  onMoveTask,
}: {
  state: IssueState;
  tasks: Task[];
  allStates: IssueState[];
  onMoveTask: (taskId: string, stateId: string) => void;
}) {
  const dotColor = STATE_TYPE_COLORS[state.type] ?? 'bg-gray-400';

  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={cn('h-2 w-2 rounded-full', dotColor)} />
        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
          {state.name}
        </span>
        <span className="ml-auto text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] rounded-full px-1.5 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 min-h-[120px] rounded-[var(--radius-md)] bg-[var(--color-surface-1)] p-2">
        {tasks.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] text-center mt-4">Vazio</p>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            states={allStates.filter((s) => s.id !== state.id)}
            onMoveState={onMoveTask}
          />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({ objectiveId }: { objectiveId?: string }) {
  const queryClient = useQueryClient();

  const { data: columns, isLoading } = useQuery({
    queryKey: ['objectives', 'kanban', objectiveId],
    queryFn: () => fetchTasksByState(objectiveId),
  });

  const { data: activeCycle } = useQuery({
    queryKey: ['objectives', 'active-cycle', objectiveId],
    queryFn: () => fetchActiveCycle(objectiveId),
  });

  const moveMutation = useMutation({
    mutationFn: ({ taskId, stateId }: { taskId: string; stateId: string }) =>
      updateTaskStateAction(taskId, stateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives', 'kanban'] });
      toast.success('Tarefa movida');
    },
    onError: () => toast.error('Erro ao mover tarefa'),
  });

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[...Array(4)].map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <div key={i} className="flex-shrink-0 w-64">
            <div className="h-5 bg-[var(--color-surface-2)] rounded mb-3 animate-pulse" />
            <div className="h-48 bg-[var(--color-surface-1)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!columns?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Nenhum estado configurado. Use /issue_states para criar estados.
          </p>
        </CardContent>
      </Card>
    );
  }

  const allStates = columns.map((c) => c.state);
  const totalTasks = columns.reduce((s, c) => s + c.tasks.length, 0);

  return (
    <div className="space-y-4">
      {activeCycle && <CycleBar cycle={activeCycle} />}

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-[var(--color-text-muted)]">
          {totalTasks} tarefa{totalTasks !== 1 ? 's' : ''} · {columns.length} estados
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(({ state, tasks }) => (
          <KanbanColumn
            key={state.id}
            state={state}
            tasks={tasks}
            allStates={allStates}
            onMoveTask={(taskId, stateId) => moveMutation.mutate({ taskId, stateId })}
          />
        ))}
      </div>
    </div>
  );
}
