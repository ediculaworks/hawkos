'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type { Demand } from '@hawk/module-demands/types';
import { Clock, Pause, RotateCcw, Search, X } from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: 'default' | 'success' | 'warning' | 'danger' | 'muted';
    icon: typeof Clock;
  }
> = {
  draft: { label: 'Rascunho', variant: 'muted', icon: Clock },
  triaging: { label: 'Analisando', variant: 'default', icon: Search },
  planned: { label: 'Planejada', variant: 'warning', icon: Clock },
  running: { label: 'Em execucao', variant: 'default', icon: RotateCcw },
  paused: { label: 'Pausada', variant: 'warning', icon: Pause },
  completed: { label: 'Concluida', variant: 'success', icon: Clock },
  failed: { label: 'Falhou', variant: 'danger', icon: X },
  cancelled: { label: 'Cancelada', variant: 'muted', icon: X },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--color-danger)',
  high: 'var(--color-warning)',
  medium: 'var(--color-accent)',
  low: 'var(--color-text-muted)',
};

type Props = {
  demand: Demand;
};

export function DemandCard({ demand }: Props) {
  const config = (STATUS_CONFIG[demand.status] ?? STATUS_CONFIG.draft) as {
    label: string;
    variant: 'default' | 'success' | 'warning' | 'danger' | 'muted';
    icon: typeof Clock;
  };
  const StatusIcon = config.icon;
  const elapsed = getElapsed(demand.created_at);

  return (
    <Link
      href={`/dashboard/demands/${demand.id}`}
      className={cn(
        'block rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-[var(--space-4)]',
        'hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-[var(--space-3)]">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {demand.title}
          </h3>
          {demand.description && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">
              {demand.description}
            </p>
          )}
        </div>
        <Badge variant={config.variant}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mt-[var(--space-3)]">
        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
          <span>
            {demand.completed_steps}/{demand.total_steps} steps
          </span>
          <span>{demand.progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${demand.progress}%`,
              backgroundColor:
                demand.progress === 100 ? 'var(--color-success)' : 'var(--color-accent)',
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-[var(--space-3)] flex items-center gap-[var(--space-3)] text-[10px] text-[var(--color-text-muted)]">
        {demand.priority && (
          <span
            className="flex items-center gap-0.5"
            style={{ color: PRIORITY_COLORS[demand.priority] }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: PRIORITY_COLORS[demand.priority] }}
            />
            {demand.priority.toUpperCase()}
          </span>
        )}
        {demand.module && (
          <span className="bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded">{demand.module}</span>
        )}
        <span className="ml-auto">{elapsed}</span>
      </div>
    </Link>
  );
}

function getElapsed(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
