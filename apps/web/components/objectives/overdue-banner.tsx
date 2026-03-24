'use client';

import { formatRelativeDay } from '@/lib/utils/format';
import type { Task } from '@hawk/module-objectives/types';
import { AlertTriangle } from 'lucide-react';

type Props = {
  tasks: Task[];
};

export function OverdueBanner({ tasks }: Props) {
  if (tasks.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] border-l-[3px] border-[var(--color-danger)] px-[var(--space-4)] py-[var(--space-3)]">
      <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
        <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-danger)]" />
        <span className="text-xs font-medium text-[var(--color-danger)]">
          {tasks.length} tarefa{tasks.length > 1 ? 's' : ''} atrasada{tasks.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-[var(--space-1)]">
        {tasks.slice(0, 3).map((t) => (
          <div key={t.id} className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)] truncate">{t.title}</span>
            <span className="text-[10px] text-[var(--color-danger)] flex-shrink-0 ml-[var(--space-2)]">
              {t.due_date ? formatRelativeDay(t.due_date) : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
