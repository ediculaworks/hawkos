'use client';

import { Button } from '@/components/ui/button';
import { RecordActions } from '@/components/ui/record-actions';
import {
  editObjective,
  fetchObjectiveWithTasks,
  removeObjective,
  setObjectiveProgress,
} from '@/lib/actions/objectives';
import { cn } from '@/lib/utils/cn';
import { formatRelativeDay } from '@/lib/utils/format';
import type { Objective } from '@hawk/module-objectives/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { InlineTaskForm } from './inline-task-form';
import { TaskRow } from './task-row';

type Props = {
  goal: Objective;
  onTaskComplete: (id: string) => void;
};

export function GoalCard({ goal, onTaskComplete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: () => editObjective(goal.id, { title: editTitle }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setEditing(false);
      toast.success('Meta atualizada');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeObjective(goal.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      toast.success('Meta excluída');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const { data: detail } = useQuery({
    queryKey: ['objectives', 'goal-detail', goal.id],
    queryFn: () => fetchObjectiveWithTasks(goal.id),
    enabled: expanded,
  });

  const progressMutation = useMutation({
    mutationFn: (progress: number) => setObjectiveProgress(goal.id, progress),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['objectives'] }),
  });

  const progressColor =
    goal.progress >= 80
      ? 'var(--color-success)'
      : goal.progress >= 40
        ? 'var(--color-warning)'
        : 'var(--color-danger)';

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="group flex w-full items-center gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] hover:bg-[var(--color-surface-2)]/50 transition-colors cursor-pointer text-left"
      >
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform flex-shrink-0',
            !expanded && '-rotate-90',
          )}
        />

        {/* Progress ring */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          className="flex-shrink-0"
          role="img"
          aria-label={`${goal.progress}%`}
        >
          <title>{goal.progress}% progresso</title>
          <circle
            cx="14"
            cy="14"
            r="11"
            fill="none"
            stroke="var(--color-surface-3)"
            strokeWidth="2.5"
          />
          <circle
            cx="14"
            cy="14"
            r="11"
            fill="none"
            stroke={progressColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${(goal.progress / 100) * 2 * Math.PI * 11} ${2 * Math.PI * 11}`}
            transform="rotate(-90 14 14)"
          />
          <text
            x="14"
            y="14"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="7"
            fill="var(--color-text-secondary)"
            fontFamily="var(--font-mono)"
          >
            {goal.progress}
          </text>
        </svg>

        <span className="text-sm font-medium text-[var(--color-text-primary)] flex-1 truncate">
          {goal.title}
        </span>

        {detail && (
          <span className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0">
            {detail.done_tasks}/{detail.done_tasks + detail.open_tasks} tarefas
          </span>
        )}

        {goal.target_date && (
          <span className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0">
            {formatRelativeDay(goal.target_date)}
          </span>
        )}

        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <RecordActions
            onEdit={() => {
              setEditing(true);
              setExpanded(true);
            }}
            onDelete={() => deleteMutation.mutate()}
          />
        </div>
      </button>

      {editing && (
        <div className="px-[var(--space-4)] py-[var(--space-3)] border-t border-[var(--color-accent)]/30 bg-[var(--color-surface-2)]">
          <div className="flex gap-[var(--space-2)]">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-[var(--space-1)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') updateMutation.mutate();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => updateMutation.mutate()}
              disabled={!editTitle || updateMutation.isPending}
            >
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-[var(--space-4)] pb-[var(--space-3)] border-t border-[var(--color-border-subtle)]">
          {/* Progress bar (clickable) */}
          <div
            role="slider"
            tabIndex={0}
            aria-valuenow={goal.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden cursor-pointer my-[var(--space-3)]"
            onKeyDown={() => {}}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
              progressMutation.mutate(Math.max(0, Math.min(100, pct)));
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${goal.progress}%`, background: progressColor }}
            />
          </div>

          {/* Child tasks */}
          {detail?.tasks.map((task) => (
            <TaskRow key={task.id} task={task} onComplete={onTaskComplete} />
          ))}

          {/* Inline add */}
          <div className="mt-[var(--space-2)]">
            <InlineTaskForm objectiveId={goal.id} />
          </div>
        </div>
      )}
    </div>
  );
}
