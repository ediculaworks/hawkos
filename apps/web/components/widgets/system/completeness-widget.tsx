'use client';

import { fetchCompletenessReport } from '@/lib/actions/completeness';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

export default function CompletenessWidget() {
  const { data } = useQuery({
    queryKey: ['system', 'completeness'],
    queryFn: () => fetchCompletenessReport(),
    staleTime: 5 * 60 * 1000,
  });

  if (!data) return null;

  return (
    <div className="space-y-[var(--space-3)]">
      {/* Score ring + headline */}
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <title>Completude do sistema</title>
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="var(--color-border-subtle)"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke={
                data.percentage >= 70 ? '#10b981' : data.percentage >= 40 ? '#f59e0b' : '#ef4444'
              }
              strokeWidth="3"
              strokeDasharray={`${(data.percentage / 100) * 94.2} 94.2`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-[var(--color-text-primary)]">
            {data.percentage}%
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {data.complete}/{data.total} módulos configurados
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {data.percentage >= 70
              ? 'Configuração completa'
              : data.percentage >= 40
                ? 'Configuração parcial'
                : 'Configure os módulos para melhores insights'}
          </p>
        </div>
      </div>

      {/* Module list */}
      <div className="space-y-1">
        {data.modules.map((m) => (
          <div key={m.moduleId} className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.complete ? 'bg-emerald-400' : m.score > 0 ? 'bg-amber-400' : 'bg-zinc-600'}`}
            />
            <span className="flex-1 text-xs text-[var(--color-text-secondary)]">{m.label}</span>
            {m.missing.length > 0 && (
              <Link
                href={`/dashboard/${m.moduleId}`}
                className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
              >
                +{m.missing.length} em falta
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
