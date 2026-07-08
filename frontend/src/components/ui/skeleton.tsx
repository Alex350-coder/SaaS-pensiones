import { cn } from '@/lib/utils';

/** Placeholder block. Uses a soft pulse; suppressed under reduced-motion. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-surface-raised',
        'motion-reduce:animate-none',
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
