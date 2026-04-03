'use client';

import { fetchActivityStats } from '@/lib/actions/observability';
import type { ActivityStats } from '@/lib/actions/observability';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, Layers, Zap } from 'lucide-react';

function StatCard({
  icon: Icon,
  label,
  value,
}: { icon: typeof Activity; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-[var(--space-2)] rounded-lg bg-[var(--color-surface-2)] p-[var(--space-2)]">
      <Icon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
      <div>
        <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
        <p className="text-sm font-semibold text-[var(--color-text)]">{value}</p>
      </div>
    </div>
  );
}

function TypeBreakdown({ stats }: { stats: ActivityStats }) {
  const sorted = Object.entries(stats.byType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (sorted.length === 0) return null;

  const max = sorted[0]?.[1] ?? 1;

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        Por tipo
      </p>
      {sorted.map(([type, count]) => (
        <div key={type} className="flex items-center gap-[var(--space-2)]">
          <span className="w-20 truncate text-[10px] text-[var(--color-text-muted)]">{type}</span>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)]"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] w-6 text-right">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ObservabilityWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['observability', 'stats'],
    queryFn: fetchActivityStats,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-[var(--space-2)] p-[var(--space-2)]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 rounded-lg bg-[var(--color-surface-2)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex h-full flex-col gap-[var(--space-3)] overflow-y-auto p-[var(--space-2)]">
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <StatCard icon={Zap} label="Eventos hoje" value={data.totalToday} />
        <StatCard icon={Layers} label="Módulos ativos" value={Object.keys(data.byModule).length} />
      </div>

      <TypeBreakdown stats={data} />

      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Últimos eventos
        </p>
        {data.recentEntries.slice(0, 5).map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between rounded p-1 text-[10px]"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock className="h-2.5 w-2.5 shrink-0 text-[var(--color-text-muted)]" />
              <span className="truncate text-[var(--color-text)]">
                {entry.summary.slice(0, 60)}
              </span>
            </div>
            {entry.module && (
              <span className="shrink-0 ml-2 rounded bg-[var(--color-surface-2)] px-1 py-0.5 text-[9px] text-[var(--color-text-muted)]">
                {entry.module}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
