import { apiFetch, type Paginated } from '@/lib/api-client';
import type { DishCategory, MenuStatus, OwnerMenuView } from '@/lib/api-types';

export interface MenuItemInput {
  dishId: string;
  course: DishCategory;
}

export function listMenus({
  page = 1,
  limit = 30,
}: { page?: number; limit?: number } = {}): Promise<Paginated<OwnerMenuView>> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<Paginated<OwnerMenuView>>(
    `/restaurants/mine/menus?${query.toString()}`,
  );
}

export function getMenu(date: string): Promise<OwnerMenuView> {
  return apiFetch<OwnerMenuView>(`/restaurants/mine/menus/${date}`);
}

export function createMenu(input: {
  menuDate: string;
  menuPrice: number;
}): Promise<OwnerMenuView> {
  return apiFetch<OwnerMenuView>('/restaurants/mine/menus', {
    method: 'POST',
    body: input,
  });
}

export function updateMenuPrice(
  date: string,
  menuPrice: number,
): Promise<OwnerMenuView> {
  return apiFetch<OwnerMenuView>(`/restaurants/mine/menus/${date}`, {
    method: 'PATCH',
    body: { menuPrice },
  });
}

export function replaceMenuItems(
  date: string,
  items: MenuItemInput[],
): Promise<OwnerMenuView> {
  return apiFetch<OwnerMenuView>(`/restaurants/mine/menus/${date}/items`, {
    method: 'PUT',
    body: { items },
  });
}

export function changeMenuStatus(
  date: string,
  status: MenuStatus,
): Promise<OwnerMenuView> {
  return apiFetch<OwnerMenuView>(`/restaurants/mine/menus/${date}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function deleteMenu(date: string): Promise<null> {
  return apiFetch<null>(`/restaurants/mine/menus/${date}`, { method: 'DELETE' });
}
