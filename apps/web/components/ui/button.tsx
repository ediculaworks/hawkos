import { cn } from '@/lib/utils/cn';
import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'default' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'icon';

const variantStyles: Record<ButtonVariant, string> = {
  default:
    'bg-[var(--color-accent)] text-[var(--color-surface-0)] hover:bg-[var(--color-accent-hover)]',
  ghost:
    'bg-transparent hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
  outline:
    'border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]',
  danger: 'bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  icon: 'h-9 w-9 p-0',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ className, variant = 'default', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
        'disabled:pointer-events-none disabled:opacity-40',
        'cursor-pointer',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  );
}
