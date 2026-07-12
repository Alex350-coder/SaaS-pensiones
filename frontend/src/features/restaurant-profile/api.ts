import { apiFetch } from '@/lib/api-client';
import type { ImageView, OwnerRestaurantView, ScheduleView } from '@/lib/api-types';

export interface RestaurantProfileInput {
  name: string;
  description: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  monthlyPensionPrice: number;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  coverImageUrl?: string;
}

export function getOwnRestaurant(): Promise<OwnerRestaurantView> {
  return apiFetch<OwnerRestaurantView>('/restaurants/mine');
}

export function createOwnRestaurant(
  input: RestaurantProfileInput,
): Promise<OwnerRestaurantView> {
  return apiFetch<OwnerRestaurantView>('/restaurants/mine', {
    method: 'POST',
    body: input,
  });
}

export function updateOwnRestaurant(
  input: Partial<RestaurantProfileInput>,
): Promise<OwnerRestaurantView> {
  return apiFetch<OwnerRestaurantView>('/restaurants/mine', {
    method: 'PATCH',
    body: input,
  });
}

export function replaceSchedules(
  schedules: ScheduleView[],
): Promise<ScheduleView[]> {
  return apiFetch<ScheduleView[]>('/restaurants/mine/schedules', {
    method: 'PUT',
    body: { schedules },
  });
}

export function addImage(url: string): Promise<ImageView> {
  return apiFetch<ImageView>('/restaurants/mine/images', {
    method: 'POST',
    body: { url },
  });
}

export function removeImage(imageId: string): Promise<null> {
  return apiFetch<null>(
    `/restaurants/mine/images/${encodeURIComponent(imageId)}`,
    { method: 'DELETE' },
  );
}
