'use client';

import { fetchGoals } from '@/lib/actions/objectives';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'var(--color-danger)',
  medium: 'var(--color-warning)',
  low: 'var(--color-accent)',
};

export default function GoalsProgressWidget() {
  const { data: goals } = useQuery({
    queryKey: ['objectives', 'goals'],
    queryFn: () => fetchGoals(),
  });

  const allGoals = useMemo(() => {
    if (!goals) return [];
    return [...(goals.short ?? []), ...(goals.medium ?? []), ...(goals.long ?? [])].sort(
      (a, b) => b.priority - a.priority,
    );
  }, [goals]);

  if (!goals) return null;

  if (allGoals.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Nenhuma meta ativa</p>;
  }

  return (
    <div className="space-y-[var(--space-3)]">
      {allGoals.map((goal) => {
        const priorityLabel = goal.priority >= 8 ? 'high' : goal.priority >= 5 ? 'medium' : 'low';
        const barColor = PRIORITY_COLORS[priorityLabel] ?? 'var(--color-accent)';

        return (
          <div key={goal.id} className="space-y-[var(--space-1)]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-primary)] truncate">
                {goal.title}
              </span>
              <span className="text-[11px] font-mono text-[var(--color-text-muted)] flex-shrink-0 ml-2">
                {goal.progress}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-[var(--duration-slow)]"
                style={{ width: `${goal.progress}%`, background: barColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
