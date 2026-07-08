import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** Base text input — 44px tall (touch target), on-brand focus ring. */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-11 w-full rounded-sm border border-border bg-surface px-3.5 text-base text-text shadow-elevation-1 transition-[border-color,box-shadow] duration-fast',
        'placeholder:text-text-muted/70',
        'focus-visible:border-primary focus-visible:outline-none focus-visible:shadow-focus-ring',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_var(--color-danger-soft)]',
        'disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
