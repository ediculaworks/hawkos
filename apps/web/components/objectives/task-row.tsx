'use client';

import { CheckPop } from '@/components/motion/micro-interactions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RecordActions } from '@/components/ui/record-actions';
import { Select } from '@/components/ui/select';
import { editTask, removeTask } from '@/lib/actions/objectives';
import { cn } from '@/lib/utils/cn';
import { formatRelativeDay, todayDateStr } from '@/lib/utils/format';
import type { Task, TaskPriority } from '@hawk/module-objectives/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--color-danger)',
  high: 'var(--color-warning)',
  medium: 'var(--color-accent)',
  low: 'var(--color-surface-4)',
};

const PRIORITY_VARIANT = {
  urgent: 'danger',
  high: 'warning',
  medium: 'default',
  low: 'muted',
} as const;

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
];

type Props = {
  task: Task;
  goalTitle?: string;
  onComplete: (id: string) => void;
};

export function TaskRow({ task, goalTitle, onComplete }: Props) {
  const today = todayDateStr();
  const isOverdue = task.due_date && task.due_date < today && task.status !== 'done';
  const isToday = task.due_date === today;
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.due_date ?? '');

  const updateMutation = useMutation({
    mutationFn: () =>
      editTask(task.id, {
        title: editTitle,
        priority: editPriority as TaskPriority,
        due_date: editDueDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setEditing(false);
      toast.success('Tarefa atualizada');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      toast.success('Tarefa excluída');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  if (editing) {
    return (
      <div className="flex flex-col gap-[var(--space-2)] py-[var(--space-2)] px-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-accent)]/30">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-[var(--space-1)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
          onKeyDown={(e) => {
            if (e.key === 'Enter') updateMutation.mutate();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <div className="flex gap-[var(--space-2)]">
          <Select
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
            options={PRIORITY_OPTIONS}
            size="sm"
          />
          <input
            type="date"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-[var(--space-1)] text-xs focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="flex justify-end gap-[var(--space-2)]">
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
    );
  }

  return (
    <div className="flex items-center gap-[var(--space-2)] py-[var(--space-2)] group">
      {/* Priority bar */}
      <div
        className="w-[3px] h-6 rounded-full flex-shrink-0"
        style={{ background: PRIORITY_COLORS[task.priority] ?? 'var(--color-surface-4)' }}
      />

      {/* Checkbox */}
      <CheckPop completed={task.status === 'done'}>
        <button
          type="button"
          onClick={() => onComplete(task.id)}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] flex-shrink-0 hover:border-[var(--color-success)] hover:bg-[var(--color-success-muted)] transition-colors cursor-pointer"
        >
          <Check className="h-3 w-3 text-transparent group-hover:text-[var(--color-success)] transition-colors" />
        </button>
      </CheckPop>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-[var(--color-text-primary)] truncate block">
          {task.title}
        </span>
        {task.description && (
          <span className="text-[11px] text-[var(--color-text-muted)] truncate block">
            {task.description}
          </span>
        )}
      </div>

      {/* In progress indicator */}
      {task.status === 'in_progress' && (
        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse flex-shrink-0" />
      )}

      {/* Blocked badge */}
      {task.status === 'blocked' && <Badge variant="warning">blocked</Badge>}

      {/* Goal badge */}
      {goalTitle && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--color-mod-objectives)]/15 text-[var(--color-mod-objectives)] truncate max-w-[100px] flex-shrink-0">
          {goalTitle}
        </span>
      )}

      {/* Due date */}
      {task.due_date && (
        <span
          className={cn(
            'text-[11px] flex-shrink-0',
            isOverdue
              ? 'text-[var(--color-danger)] font-medium'
              : isToday
                ? 'text-[var(--color-warning)]'
                : 'text-[var(--color-text-muted)]',
          )}
        >
          {formatRelativeDay(task.due_date)}
        </span>
      )}

      {/* Priority badge (small) */}
      <Badge variant={PRIORITY_VARIANT[task.priority] ?? 'muted'}>
        {task.priority[0]?.toUpperCase()}
      </Badge>

      {/* Edit/Delete actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <RecordActions onEdit={() => setEditing(true)} onDelete={() => deleteMutation.mutate()} />
      </div>
    </div>
  );
}
