import { cn } from '@/lib/utils/cn';
import type { HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'muted';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)]',
  success: 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]',
  muted: 'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]',
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
