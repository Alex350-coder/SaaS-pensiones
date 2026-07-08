import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getRestaurant, listRestaurants } from './api';

export const restaurantKeys = {
  all: ['restaurants'] as const,
  list: (page: number, limit: number) =>
    [...restaurantKeys.all, 'list', { page, limit }] as const,
  detail: (slug: string) => [...restaurantKeys.all, 'detail', slug] as const,
};

/** Public catalog page. Keeps prior page visible while the next one loads. */
export function useRestaurants(page: number, limit = 12) {
  return useQuery({
    queryKey: restaurantKeys.list(page, limit),
    queryFn: () => listRestaurants({ page, limit }),
    placeholderData: keepPreviousData,
  });
}

/** Public restaurant detail by slug. */
export function useRestaurant(slug: string | undefined) {
  return useQuery({
    queryKey: restaurantKeys.detail(slug ?? ''),
    queryFn: () => getRestaurant(slug as string),
    enabled: Boolean(slug),
  });
}
