'use client';

import { cn } from '@/lib/utils/cn';
import type { LucideIcon } from 'lucide-react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

interface TabBarProps<T extends string = string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (tab: T) => void;
  variant?: 'pill' | 'underline';
  size?: 'sm' | 'md';
  className?: string;
}

export function TabBar<T extends string = string>({
  tabs,
  active,
  onChange,
  variant = 'pill',
  size = 'md',
  className,
}: TabBarProps<T>) {
  if (variant === 'underline') {
    return (
      <div className={cn('flex gap-0 border-b border-[var(--color-border-subtle)]', className)}>
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex items-center gap-[var(--space-1-5)] border-b-2 -mb-px font-medium transition-colors cursor-pointer',
                size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
                isActive
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-[var(--space-0-5)] p-[var(--space-0-5)] rounded-[var(--radius-md)] bg-[var(--color-surface-1)]',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-[var(--space-1-5)] rounded-[var(--radius-sm)] font-medium transition-colors cursor-pointer',
              size === 'sm'
                ? 'px-[var(--space-3)] py-1 text-xs'
                : 'px-[var(--space-3)] py-1.5 text-sm',
              isActive
                ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
