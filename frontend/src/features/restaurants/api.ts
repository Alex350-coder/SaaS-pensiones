import { apiFetch, type Paginated } from '@/lib/api-client';
import type {
  PublicRestaurantDetail,
  PublicRestaurantListItem,
} from '@/lib/api-types';

export interface ListParams {
  page?: number;
  limit?: number;
}

export function listRestaurants({
  page = 1,
  limit = 12,
}: ListParams = {}): Promise<Paginated<PublicRestaurantListItem>> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return apiFetch<Paginated<PublicRestaurantListItem>>(
    `/restaurants?${query.toString()}`,
    { auth: false },
  );
}

export function getRestaurant(slug: string): Promise<PublicRestaurantDetail> {
  return apiFetch<PublicRestaurantDetail>(
    `/restaurants/${encodeURIComponent(slug)}`,
    { auth: false },
  );
}
