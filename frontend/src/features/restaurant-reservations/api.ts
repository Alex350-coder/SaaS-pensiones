import { apiFetch, type Paginated } from '@/lib/api-client';
import type {
  ProductionProjectionView,
  RestaurantReservationView,
} from '@/lib/api-types';

export function listDayReservations({
  date,
  page = 1,
  limit = 100,
}: { date?: string; page?: number; limit?: number } = {}): Promise<
  Paginated<RestaurantReservationView>
> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (date) query.set('date', date);
  return apiFetch<Paginated<RestaurantReservationView>>(
    `/restaurants/mine/reservations?${query.toString()}`,
  );
}

export function getProjection(date?: string): Promise<ProductionProjectionView> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch<ProductionProjectionView>(
    `/restaurants/mine/production-projection${query}`,
  );
}
