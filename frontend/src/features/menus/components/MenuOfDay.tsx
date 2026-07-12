import { CalendarDays, UtensilsCrossed } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StateMessage } from '@/components/shared/state-message';
import { ErrorState } from '@/components/shared/state-message';
import { formatCurrency, formatMenuDate } from '@/lib/format';
import { isMenuNotFound, usePublicMenu } from '../hooks';
import { MenuCourseList } from './MenuCourseList';

export function MenuOfDay({ slug }: { slug: string }) {
  const { data, isLoading, isError, error, refetch } = usePublicMenu(slug);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    if (isMenuNotFound(error)) {
      return (
        <StateMessage
          icon={UtensilsCrossed}
          title="Aún no hay menú para hoy"
          description="Este restaurante todavía no publicó su menú del día. Vuelve más tarde."
        />
      );
    }
    return <ErrorState onRetry={() => void refetch()} />;
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
          <UtensilsCrossed className="size-5 text-primary" aria-hidden="true" />
          Menú del día
        </h2>
        <p className="flex items-center gap-1.5 text-sm text-text-muted">
          <CalendarDays className="size-4" aria-hidden="true" />
          <span className="capitalize">{formatMenuDate(data.menuDate)}</span>
        </p>
      </div>

      <MenuCourseList items={data.items} />

      <div className="flex items-center justify-between rounded-md bg-surface-raised px-4 py-3">
        <span className="text-sm font-medium text-text-muted">Precio del menú</span>
        <span className="text-lg font-bold text-primary tabular-nums">
          {formatCurrency(data.menuPrice)}
        </span>
      </div>
    </div>
  );
}
