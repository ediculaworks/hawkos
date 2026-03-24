'use client';

import { Button } from '@/components/ui/button';
import { addHobbyLog } from '@/lib/actions/entertainment';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function AddHobbyForm({ onClose }: { onClose?: () => void }) {
  const queryClient = useQueryClient();
  const [activity, setActivity] = useState('');
  const [duration, setDuration] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      addHobbyLog({
        activity,
        duration_min: duration ? Number.parseInt(duration, 10) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entertainment'] });
      setActivity('');
      setDuration('');
      toast.success('Hobby registrado!');
      onClose?.();
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  return (
    <div className="flex gap-[var(--space-2)] items-end">
      <input
        type="text"
        value={activity}
        onChange={(e) => setActivity(e.target.value)}
        placeholder="Atividade"
        className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && activity) mutation.mutate();
          if (e.key === 'Escape') onClose?.();
        }}
      />
      <input
        type="number"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        placeholder="Min"
        className="w-20 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-[var(--space-1-5)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
      />
      <Button
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={!activity || mutation.isPending}
      >
        Salvar
      </Button>
    </div>
  );
}
