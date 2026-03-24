import * as React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  htmlFor?: string;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, htmlFor, children, ...props }, ref) => {
    return (
      <label
        htmlFor={htmlFor}
        ref={ref}
        className={`text-sm font-medium text-[var(--color-text-secondary)] ${className ?? ''}`}
        {...props}
      >
        {children}
      </label>
    );
  },
);
Label.displayName = 'Label';

export { Label };
