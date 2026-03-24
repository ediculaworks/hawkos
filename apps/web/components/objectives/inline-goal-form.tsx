'use client';

import { addObjective } from '@/lib/actions/objectives';
import { cn } from '@/lib/utils/cn';
import type { ObjectiveTimeframe } from '@hawk/module-objectives/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';

type Props = {
  onClose: () => void;
};

export function InlineGoalForm({ onClose }: Props) {
  const [title, setTitle] = useState('');
  const [timeframe, setTimeframe] = useState<ObjectiveTimeframe>('short');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => addObjective({ title, timeframe }),
    onSuccess: () => {
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      onClose();
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar objetivo: ${err.message}`);
    },
  });

  return (
    <div className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-surface-1)] px-[var(--space-3)] py-[var(--space-2)]">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) mutation.mutate();
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Nome da meta..."
        className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
      />
      <div className="flex gap-[var(--space-0-5)]">
        {(['short', 'medium', 'long'] as const).map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setTimeframe(tf)}
            className={cn(
              'px-[var(--space-2)] py-[var(--space-0-5)] rounded-[var(--radius-sm)] text-[11px] font-medium transition-colors cursor-pointer',
              timeframe === tf
                ? 'bg-[var(--color-accent)] text-[var(--color-surface-0)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
            )}
          >
            {tf === 'short' ? 'C' : tf === 'medium' ? 'M' : 'L'}
          </button>
        ))}
      </div>
    </div>
  );
}
