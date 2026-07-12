import { apiFetch, type Paginated } from '@/lib/api-client';
import type { DishCategory, DishView } from '@/lib/api-types';

export interface DishInput {
  name: string;
  description?: string | null;
  category: DishCategory;
  price: number;
  imageUrl?: string | null;
  isActive?: boolean;
}

export function listDishes({
  page = 1,
  limit = 100,
}: { page?: number; limit?: number } = {}): Promise<Paginated<DishView>> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<Paginated<DishView>>(
    `/restaurants/mine/dishes?${query.toString()}`,
  );
}

export function createDish(input: DishInput): Promise<DishView> {
  return apiFetch<DishView>('/restaurants/mine/dishes', {
    method: 'POST',
    body: input,
  });
}

export function updateDish(
  id: string,
  input: Partial<DishInput>,
): Promise<DishView> {
  return apiFetch<DishView>(`/restaurants/mine/dishes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteDish(id: string): Promise<null> {
  return apiFetch<null>(`/restaurants/mine/dishes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
