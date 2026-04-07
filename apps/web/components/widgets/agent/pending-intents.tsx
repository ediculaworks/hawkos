'use client';

import { dismissPendingIntent, fetchPendingIntents } from '@/lib/actions/pending';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';

export default function PendingIntentsWidget() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['pending-intents'],
    queryFn: () => fetchPendingIntents(),
    staleTime: 60 * 1000,
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissPendingIntent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-intents'] });
    },
  });

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <span className="text-emerald-400">✓</span>
        Nenhuma ação pendente
      </div>
    );
  }

  return (
    <div className="space-y-[var(--space-2)]">
      {data.map((intent) => (
        <div
          key={intent.id}
          className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">
              {intent.description}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-amber-400">
              {intent.prerequisiteMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dismiss.mutate(intent.id)}
            disabled={dismiss.isPending}
            className="shrink-0 rounded p-0.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
            aria-label="Dispensar"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <p className="text-[10px] text-[var(--color-text-muted)]">
        Use /pendentes no Discord para executar
      </p>
    </div>
  );
}
