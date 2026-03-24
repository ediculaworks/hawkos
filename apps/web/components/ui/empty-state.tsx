'use client';

import type { LucideIcon } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-[var(--space-3)] rounded-full bg-[var(--color-surface-2)] p-[var(--space-4)]">
        <Icon className="h-8 w-8 text-[var(--color-text-muted)]" />
      </div>
      <p className="mb-[var(--space-1)] text-sm font-medium text-[var(--color-text-secondary)]">
        {title}
      </p>
      {description && (
        <p className="mb-[var(--space-4)] text-xs text-[var(--color-text-muted)] max-w-xs">
          {description}
        </p>
      )}
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
