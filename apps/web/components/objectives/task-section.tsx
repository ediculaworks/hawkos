'use client';

import { cn } from '@/lib/utils/cn';
import type { Task } from '@hawk/module-objectives/types';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { TaskRow } from './task-row';

type Props = {
  label: string;
  tasks: Task[];
  goalTitles?: Record<string, string>;
  onComplete: (id: string) => void;
  defaultCollapsed?: boolean;
  emptyMessage?: string;
};

export function TaskSection({
  label,
  tasks,
  goalTitles,
  onComplete,
  defaultCollapsed = false,
  emptyMessage,
}: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (tasks.length === 0 && !emptyMessage) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-[var(--space-1-5)] mb-[var(--space-1)] cursor-pointer group"
      >
        <ChevronDown
          className={cn(
            'h-3 w-3 text-[var(--color-text-muted)] transition-transform',
            collapsed && '-rotate-90',
          )}
        />
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[11px] text-[var(--color-text-muted)]">{tasks.length}</span>
      </button>

      {!collapsed && (
        <div className="space-y-[var(--space-0-5)] ml-[var(--space-1)]">
          {tasks.length === 0 && emptyMessage ? (
            <p className="text-xs text-[var(--color-text-muted)] py-[var(--space-2)] ml-[var(--space-4)]">
              {emptyMessage}
            </p>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                goalTitle={task.objective_id ? goalTitles?.[task.objective_id] : undefined}
                onComplete={onComplete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
