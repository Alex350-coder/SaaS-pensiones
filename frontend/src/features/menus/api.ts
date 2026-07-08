import { apiFetch } from '@/lib/api-client';
import type { PublicMenu } from '@/lib/api-types';

/**
 * Public "menú del día". `date` is optional (YYYY-MM-DD); the backend defaults
 * to today. Returns 404 `MENU_NOT_FOUND` when there is no published menu —
 * callers treat that as an empty state, not a hard failure.
 */
export function getPublicMenu(slug: string, date?: string): Promise<PublicMenu> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch<PublicMenu>(
    `/restaurants/${encodeURIComponent(slug)}/menu${query}`,
    { auth: false },
  );
}
