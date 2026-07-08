import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StateMessageProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  tone?: 'neutral' | 'danger';
}

/** Shared empty/error scaffold so every surface handles no-data/failure alike. */
export function StateMessage({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  tone = 'neutral',
}: StateMessageProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-14 text-center',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-12 items-center justify-center rounded-full',
          tone === 'danger'
            ? 'bg-danger-soft text-danger'
            : 'bg-surface-raised text-text-muted',
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-text">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-text-muted text-pretty">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** Failure state with a recovery path (error-recovery UX rule). */
export function ErrorState({
  title = 'Algo salió mal',
  description = 'No pudimos cargar la información. Vuelve a intentarlo en un momento.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <StateMessage
      icon={AlertTriangle}
      tone="danger"
      title={title}
      description={description}
      className={className}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        )
      }
    />
  );
}
