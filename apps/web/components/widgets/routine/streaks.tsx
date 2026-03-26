'use client';

import { EmptyState } from '@/components/ui/empty-state';
import { fetchWeekSummary } from '@/lib/actions/routine';
import { useQuery } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
import { useMemo } from 'react';

export default function StreaksWidget() {
  const { data: summary } = useQuery({
    queryKey: ['routine', 'week-summary'],
    queryFn: () => fetchWeekSummary(),
  });

  if (!summary || summary.length === 0) {
    return (
      <EmptyState
        icon={Zap}
        title="Sem dados de streaks"
        description="Complete seus hábitos para ver suas sequências"
      />
    );
  }

  const sorted = useMemo(
    () => [...summary].sort((a, b) => b.habit.current_streak - a.habit.current_streak),
    [summary],
  );

  return (
    <div className="space-y-[var(--space-2)]">
      {sorted.map((item) => (
        <div key={item.habit.id} className="flex items-center gap-[var(--space-3)]">
          <div className="flex items-center gap-1 text-[var(--color-warning)] w-10 flex-shrink-0">
            <Zap className="h-3 w-3" />
            <span className="text-xs font-medium">{item.habit.current_streak}</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-[var(--color-text-secondary)] truncate block">
              {item.habit.name}
            </span>
          </div>
          <div className="flex-shrink-0 w-20">
            <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-success)] transition-all duration-[var(--duration-slow)]"
                style={{ width: `${item.completion_rate}%` }}
              />
            </div>
          </div>
          <span className="text-[11px] text-[var(--color-text-muted)] w-8 text-right flex-shrink-0">
            {item.week_completions}/{item.week_target}
          </span>
        </div>
      ))}
    </div>
  );
}
