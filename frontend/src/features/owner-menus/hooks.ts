import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import type { MenuStatus } from '@/lib/api-types';
import type { MenuItemInput } from './api';
import * as api from './api';

export const menuKeys = {
  all: ['owner-menus'] as const,
  detail: (date: string) => [...menuKeys.all, 'detail', date] as const,
};

export function useOwnerMenu(date: string) {
  return useQuery({
    queryKey: menuKeys.detail(date),
    queryFn: () => api.getMenu(date),
    // A missing menu is a normal empty state — don't retry the 404.
    retry: (count, error) => !(error instanceof ApiError) && count < 1,
  });
}

/** True when the error is the expected "no menu for this date" 404. */
export function isMenuNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MENU_NOT_FOUND';
}

function useMenuMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: menuKeys.all }),
  });
}

export const useCreateMenu = () =>
  useMenuMutation((input: { menuDate: string; menuPrice: number }) =>
    api.createMenu(input),
  );

export const useUpdateMenuPrice = () =>
  useMenuMutation(({ date, menuPrice }: { date: string; menuPrice: number }) =>
    api.updateMenuPrice(date, menuPrice),
  );

export const useReplaceMenuItems = () =>
  useMenuMutation(({ date, items }: { date: string; items: MenuItemInput[] }) =>
    api.replaceMenuItems(date, items),
  );

export const useChangeMenuStatus = () =>
  useMenuMutation(({ date, status }: { date: string; status: MenuStatus }) =>
    api.changeMenuStatus(date, status),
  );

export const useDeleteMenu = () =>
  useMenuMutation((date: string) => api.deleteMenu(date));
