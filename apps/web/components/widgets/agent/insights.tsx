'use client';

import { fetchInsights } from '@/lib/actions/insights';
import type { Insight } from '@/lib/actions/insights';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Info, Lightbulb } from 'lucide-react';
import Link from 'next/link';

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    bg: 'bg-[var(--color-danger)]/10',
    border: 'border-[var(--color-danger)]/30',
    text: 'text-[var(--color-danger)]',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-[oklch(0.75_0.18_65)]/10',
    border: 'border-[oklch(0.75_0.18_65)]/30',
    text: 'text-[oklch(0.75_0.18_65)]',
  },
  info: {
    icon: Info,
    bg: 'bg-[var(--color-accent)]/10',
    border: 'border-[var(--color-accent)]/30',
    text: 'text-[var(--color-accent)]',
  },
};

const TYPE_ICONS = {
  gap: Lightbulb,
  streak: CheckCircle,
  alert: AlertTriangle,
  suggestion: Info,
};

function InsightCard({ insight }: { insight: Insight }) {
  const sev = SEVERITY_CONFIG[insight.severity];
  const TypeIcon = TYPE_ICONS[insight.type];

  return (
    <div
      className={`flex items-start gap-[var(--space-2)] rounded-lg border p-[var(--space-2)] ${sev.bg} ${sev.border}`}
    >
      <TypeIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${sev.text}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-semibold leading-tight ${sev.text}`}>{insight.title}</p>
        <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)] leading-snug">
          {insight.description}
        </p>
        {insight.actionHref && insight.actionLabel && (
          <Link
            href={insight.actionHref}
            className="mt-1 inline-block text-[10px] font-medium text-[var(--color-accent)] hover:underline"
          >
            {insight.actionLabel} →
          </Link>
        )}
      </div>
    </div>
  );
}

export default function InsightsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['insights'],
    queryFn: fetchInsights,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-[var(--space-2)] p-[var(--space-2)]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-[var(--color-surface-2)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[var(--space-2)] text-center">
        <CheckCircle className="h-8 w-8 text-[var(--color-success)]" />
        <p className="text-[11px] font-medium text-[var(--color-text-muted)]">Tudo em dia!</p>
        <p className="text-[10px] text-[var(--color-text-muted)]">Nenhuma ação pendente.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-[var(--space-1)] overflow-y-auto p-[var(--space-2)]">
      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {data.length} insight{data.length > 1 ? 's' : ''}
      </p>
      {data.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
}
