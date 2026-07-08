import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import { getPublicMenu } from './api';

export const menuKeys = {
  all: ['menus'] as const,
  ofDay: (slug: string, date?: string) =>
    [...menuKeys.all, slug, date ?? 'today'] as const,
};

/**
 * Today's (or a given date's) public menu. A missing menu is a normal empty
 * state, so we don't retry `MENU_NOT_FOUND` and let the component branch on it.
 */
export function usePublicMenu(slug: string | undefined, date?: string) {
  return useQuery({
    queryKey: menuKeys.ofDay(slug ?? '', date),
    queryFn: () => getPublicMenu(slug as string, date),
    enabled: Boolean(slug),
    retry: (count, error) => {
      if (error instanceof ApiError) return false;
      return count < 1;
    },
  });
}

/** True when the error is the expected "no menu for this date" 404. */
export function isMenuNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MENU_NOT_FOUND';
}
