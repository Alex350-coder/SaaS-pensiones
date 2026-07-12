import {
  CookingPot,
  Croissant,
  CupSoda,
  IceCreamBowl,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DishCategory, MenuItemView } from '@/lib/api-types';

const COURSE_ORDER: DishCategory[] = ['STARTER', 'MAIN', 'BEVERAGE', 'DESSERT'];

const COURSE_META: Record<DishCategory, { label: string; icon: LucideIcon }> =
  {
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

/** Presentational course list (sorted starter → dessert). Shared by the public
 *  menu display and the client reserve flow. */
export function MenuCourseList({ items }: { items: MenuItemView[] }) {
  const sorted = [...items].sort(
    (a, b) => COURSE_ORDER.indexOf(a.course) - COURSE_ORDER.indexOf(b.course),
  );
  return (
    <ul className="divide-y divide-border">
      {sorted.map((item) => (
        <CourseRow key={item.id} item={item} />
      ))}
    </ul>
  );
}
