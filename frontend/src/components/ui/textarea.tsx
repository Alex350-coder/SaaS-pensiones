import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[2.75rem] w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text shadow-sm transition-colors',
      'placeholder:text-text-muted focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-focus-ring',
      'disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
