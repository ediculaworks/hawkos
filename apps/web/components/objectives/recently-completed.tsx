'use client';

import { fetchRecentlyCompleted } from '@/lib/actions/objectives';
import { cn } from '@/lib/utils/cn';
import { formatRelativeDay } from '@/lib/utils/format';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function RecentlyCompleted() {
  const [expanded, setExpanded] = useState(false);

  const { data: tasks } = useQuery({
    queryKey: ['objectives', 'recently-completed'],
    queryFn: () => fetchRecentlyCompleted(5),
  });

  if (!tasks || tasks.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-[var(--space-1-5)] cursor-pointer group mb-[var(--space-1)]"
      >
        <ChevronDown
          className={cn(
            'h-3 w-3 text-[var(--color-text-muted)] transition-transform',
            !expanded && '-rotate-90',
          )}
        />
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Concluídas
        </span>
        <span className="text-[11px] text-[var(--color-text-muted)]">{tasks.length}</span>
      </button>

      {expanded && (
        <div className="space-y-[var(--space-1)] ml-[var(--space-1)]">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-[var(--space-2)] py-[var(--space-1)]"
            >
              <CheckCircle2 className="h-4 w-4 text-[var(--color-success)] flex-shrink-0" />
              <span className="text-sm text-[var(--color-text-muted)] line-through truncate flex-1">
                {task.title}
              </span>
              {task.completed_at && (
                <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                  {formatRelativeDay(task.completed_at)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
