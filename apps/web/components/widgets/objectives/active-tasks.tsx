'use client';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchActiveTasks, removeTask, setTaskStatus } from '@/lib/actions/objectives';
import { formatRelativeDay } from '@/lib/utils/format';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PauseCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PRIORITY_VARIANT = {
  urgent: 'danger',
  high: 'warning',
  medium: 'default',
  low: 'muted',
} as const;

export default function ActiveTasksWidget() {
  const queryClient = useQueryClient();
  const { data: tasks } = useQuery({
    queryKey: ['objectives', 'tasks-active'],
    queryFn: () => fetchActiveTasks(12),
  });

  const mutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: 'done' | 'blocked' }) =>
      setTaskStatus(taskId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar tarefa.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      toast.success('Tarefa excluída');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  if (!tasks || tasks.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nenhuma tarefa pendente"
        description="Todas as tarefas estão completas ou bloqueadas"
      />
    );
  }

  return (
    <div className="space-y-[var(--space-1)]">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-[var(--space-2)] py-[var(--space-1-5)] group"
        >
          <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => mutation.mutate({ taskId: task.id, status: 'done' })}
              className="p-0.5 text-[var(--color-success)] hover:bg-[var(--color-success-muted)] rounded transition-colors cursor-pointer"
              title="Concluir"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => mutation.mutate({ taskId: task.id, status: 'blocked' })}
              className="p-0.5 text-[var(--color-warning)] hover:bg-[var(--color-warning-muted)] rounded transition-colors cursor-pointer"
              title="Bloquear"
            >
              <PauseCircle className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(task.id)}
              className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded transition-colors cursor-pointer"
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-sm text-[var(--color-text-secondary)] flex-1 truncate">
            {task.title}
          </span>
          <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
          {task.due_date && (
            <span className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0">
              {formatRelativeDay(task.due_date)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
