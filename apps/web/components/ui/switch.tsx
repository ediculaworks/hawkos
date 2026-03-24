import * as React from 'react';

export interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, id }, ref) => {
    return (
      <button
        type="button"
        ref={ref}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        id={id}
        onClick={() => onCheckedChange?.(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-2)]'} ${className ?? ''}`}
      >
        <span
          className={`pointer-events-none block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </button>
    );
  },
);
Switch.displayName = 'Switch';

export { Switch };
