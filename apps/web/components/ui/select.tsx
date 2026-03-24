import { cn } from '@/lib/utils/cn';
import { ChevronDown } from 'lucide-react';
import * as React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md';
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, size = 'md', ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'w-full appearance-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] pr-8 text-[var(--color-text-primary)]',
            'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'cursor-pointer',
            size === 'sm' ? 'h-8 px-2 py-1 text-xs' : 'h-10 px-3 py-2 text-sm',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select };
