'use client';

import { addTask } from '@/lib/actions/objectives';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

type Props = {
  objectiveId?: string;
  autoFocus?: boolean;
};

export function InlineTaskForm({ objectiveId, autoFocus }: Props) {
  const [title, setTitle] = useState('');
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (autoFocus) setActive(true);
  }, [autoFocus]);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => addTask({ title, objective_id: objectiveId, priority: 'medium' }),
    onSuccess: () => {
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar tarefa: ${err.message}`);
    },
  });

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="flex items-center gap-[var(--space-1-5)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer py-[var(--space-1)]"
      >
        <Plus className="h-3 w-3" /> Adicionar tarefa
      </button>
    );
  }

  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: programmatic focus via keyboard shortcut
      autoFocus={autoFocus}
      type="text"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && title.trim()) mutation.mutate();
        if (e.key === 'Escape') {
          setActive(false);
          setTitle('');
        }
      }}
      onBlur={() => {
        if (!title.trim()) setActive(false);
      }}
      placeholder="Nova tarefa... (Enter pra criar, Esc pra cancelar)"
      className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
    />
  );
}
