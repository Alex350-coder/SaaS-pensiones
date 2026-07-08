import { Skeleton } from '@/components/ui/skeleton';

/** Matches RestaurantCard's footprint so the grid doesn't reflow on load. */
export function RestaurantCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-elevation-1">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="size-8 rounded-full" />
      </div>
    </div>
  );
}

export function RestaurantGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <RestaurantCardSkeleton key={i} />
      ))}
    </div>
  );
}
