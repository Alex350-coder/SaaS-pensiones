import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeadingProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** Consistent title + optional action row for every private page. */
export function PageHeading({
  title,
  description,
  actions,
  className,
}: PageHeadingProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-4',
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-text-muted text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
