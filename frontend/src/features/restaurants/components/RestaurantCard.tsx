import { ArrowRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CoverImage } from '@/components/shared/CoverImage';
import type { PublicRestaurantListItem } from '@/lib/api-types';
import { formatCurrency } from '@/lib/format';

interface RestaurantCardProps {
  restaurant: PublicRestaurantListItem;
  /** Above-the-fold cards can eager-load their cover for a faster LCP. */
  priority?: boolean;
}

/**
 * Catalog centerpiece. At rest: cover + name + monthly price. On hover: lifts
 * (elevation + translateY) and the cover scales subtly. The whole card is one
 * link; motion is decorative, so reduced-motion neutralizes the transforms.
 */
export function RestaurantCard({ restaurant, priority = false }: RestaurantCardProps) {
  return (
    <article className="group">
      <Link
        to={`/restaurantes/${restaurant.slug}`}
        aria-label={`Ver ${restaurant.name}`}
        className="block overflow-hidden rounded-lg border border-border bg-surface shadow-elevation-1 transition-[transform,box-shadow] duration-normal ease-out-expo hover:-translate-y-1 hover:shadow-elevation-3 focus-visible:outline-none focus-visible:shadow-focus-ring motion-reduce:hover:translate-y-0"
      >
        <div className="relative overflow-hidden">
          <CoverImage
            src={restaurant.coverImageUrl}
            alt=""
            name={restaurant.name}
            withGradient
            loading={priority ? 'eager' : 'lazy'}
            className="transition-transform duration-slow ease-out-expo group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
          />

          <div className="pointer-events-none absolute right-3 top-3">
            <span className="glass rounded-full px-3 py-1 text-sm font-semibold text-white tabular-nums shadow-elevation-2">
              {formatCurrency(restaurant.monthlyPensionPrice)}
              <span className="font-normal text-white/80"> /mes</span>
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="text-lg font-semibold leading-tight text-white text-balance">
              {restaurant.name}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{restaurant.address}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <p className="line-clamp-1 text-sm text-text-muted">
            {restaurant.description}
          </p>
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-active transition-transform duration-fast group-hover:translate-x-0.5"
            aria-hidden="true"
          >
            <ArrowRight className="size-4" />
          </span>
        </div>
      </Link>
    </article>
  );
}
