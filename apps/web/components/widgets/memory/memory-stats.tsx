'use client';

import { fetchMemoryStats } from '@/lib/actions/memory';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

const CATEGORY_LABELS: Record<string, string> = {
  preference: 'Preferências',
  fact: 'Fatos',
  pattern: 'Padrões',
  insight: 'Insights',
  correction: 'Correções',
  goal: 'Metas',
  relationship: 'Relações',
};

export default function MemoryStatsWidget() {
  const { data: stats } = useQuery({
    queryKey: ['memory', 'stats'],
    queryFn: () => fetchMemoryStats(),
  });

  if (!stats) return null;

  const topCategories = Object.entries(stats.by_category)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-semibold text-[var(--color-text-primary)]">
          {stats.total}
        </span>
        {stats.pending_count > 0 && (
          <Link
            href="/dashboard/memory"
            className="flex items-center gap-1 text-[11px] text-[var(--color-warning)] hover:underline"
          >
            <AlertCircle className="h-3 w-3" />
            {stats.pending_count} pendentes
          </Link>
        )}
      </div>

      <div className="space-y-[var(--space-1-5)]">
        {topCategories.map(([cat, count]) => (
          <div key={cat} className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">
              {CATEGORY_LABELS[cat] ?? cat}
            </span>
            <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{count}</span>
          </div>
        ))}
      </div>

      <Link
        href="/dashboard/memory"
        className="block text-center text-[11px] text-[var(--color-accent)] hover:underline pt-[var(--space-2)] border-t border-[var(--color-border-subtle)]"
      >
        Ver constelação →
      </Link>
    </div>
  );
}
