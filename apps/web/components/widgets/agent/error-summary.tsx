'use client';

import { fetchErrorSummary } from '@/lib/actions/usage';
import type { ErrorSummaryEntry } from '@/lib/actions/usage';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'agora';
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function ErrorSummaryWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['errors', 'summary'],
    queryFn: () => fetchErrorSummary(7),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-[var(--space-2)] p-[var(--space-2)]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 rounded-lg bg-[var(--color-surface-2)] animate-pulse" />
        ))}
      </div>
    );
  }

  const entries = data ?? [];
  const totalErrors = entries.reduce((sum, e) => sum + e.count, 0);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--color-text-muted)]">
        <CheckCircle className="h-6 w-6 text-green-400" />
        <p className="text-xs">Sem erros nos últimos 7 dias</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-[var(--space-3)] overflow-y-auto p-[var(--space-2)]">
      <div className="flex items-center gap-[var(--space-2)] rounded-lg bg-[var(--color-surface-2)] p-[var(--space-2)]">
        <AlertCircle className="h-3.5 w-3.5 text-red-400" />
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)]">Erros (7d)</p>
          <p className="text-sm font-semibold text-[var(--color-text)]">{totalErrors}</p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Por componente
        </p>
        {entries.map((entry, i) => (
          <div
            key={`${entry.event_type}-${entry.component}-${i}`}
            className="flex items-center justify-between rounded p-1.5 bg-[var(--color-surface-2)]"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-400" />
              <span className="truncate text-[10px] text-[var(--color-text)]">
                {entry.component}
              </span>
              <span className="text-[9px] text-[var(--color-text-muted)]">
                ({entry.event_type})
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-[10px] font-semibold text-red-400">{entry.count}x</span>
              <span className="flex items-center gap-0.5 text-[9px] text-[var(--color-text-muted)]">
                <Clock className="h-2 w-2" />
                {timeAgo(entry.last_seen)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
