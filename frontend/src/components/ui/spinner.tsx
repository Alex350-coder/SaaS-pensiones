import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  label?: string;
}

/** Accessible loading spinner for page/section-level async states. */
export function Spinner({ className, label = 'Cargando…' }: SpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-text-muted">
      <Loader2
        className={cn('size-5 animate-spin text-primary', className)}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
