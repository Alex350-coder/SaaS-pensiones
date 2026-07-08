import { CalendarDays, CookingPot, Croissant, CupSoda, IceCreamBowl, UtensilsCrossed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StateMessage } from '@/components/shared/state-message';
import { ErrorState } from '@/components/shared/state-message';
import type { DishCategory, MenuItemView } from '@/lib/api-types';
import { formatCurrency, formatMenuDate } from '@/lib/format';
import { isMenuNotFound, usePublicMenu } from '../hooks';

const COURSE_ORDER: DishCategory[] = ['STARTER', 'MAIN', 'BEVERAGE', 'DESSERT'];

const COURSE_META: Record<DishCategory, { label: string; icon: LucideIcon }> = {
  STARTER: { label: 'Entrada', icon: Croissant },
  MAIN: { label: 'Plato principal', icon: CookingPot },
  BEVERAGE: { label: 'Bebida', icon: CupSoda },
  DESSERT: { label: 'Postre', icon: IceCreamBowl },
};

function CourseRow({ item }: { item: MenuItemView }) {
  const meta = COURSE_META[item.course];
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-active">
        <Icon className="size-[1.125rem]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {meta.label}
        </p>
        <p className="font-medium text-text">{item.dish.name}</p>
        {item.dish.description && (
          <p className="text-sm text-text-muted text-pretty">
            {item.dish.description}
          </p>
        )}
      </div>
    </li>
  );
}

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

  const items = [...data.items].sort(
    (a, b) => COURSE_ORDER.indexOf(a.course) - COURSE_ORDER.indexOf(b.course),
  );

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

      <ul className="divide-y divide-border">
        {items.map((item) => (
          <CourseRow key={item.id} item={item} />
        ))}
      </ul>

      <div className="flex items-center justify-between rounded-md bg-surface-raised px-4 py-3">
        <span className="text-sm font-medium text-text-muted">Precio del menú</span>
        <span className="text-lg font-bold text-primary tabular-nums">
          {formatCurrency(data.menuPrice)}
        </span>
      </div>
    </div>
  );
}
