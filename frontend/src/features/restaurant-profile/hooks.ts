import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import * as api from './api';

export const ownRestaurantKeys = {
  all: ['own-restaurant'] as const,
};

/** The owner's restaurant. A 404 (`RESTAURANT_NOT_FOUND`) is the "not created
 *  yet" state, not an error — don't retry it; callers branch on it. */
export function useOwnRestaurant() {
  return useQuery({
    queryKey: ownRestaurantKeys.all,
    queryFn: api.getOwnRestaurant,
    retry: (count, error) => !(error instanceof ApiError) && count < 1,
  });
}

/** True when the owner has not registered a restaurant yet. */
export function isNoRestaurant(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function useOwnRestaurantMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ownRestaurantKeys.all }),
  });
}

export const useCreateOwnRestaurant = () =>
  useOwnRestaurantMutation(api.createOwnRestaurant);
export const useUpdateOwnRestaurant = () =>
  useOwnRestaurantMutation(api.updateOwnRestaurant);
export const useReplaceSchedules = () =>
  useOwnRestaurantMutation(api.replaceSchedules);
export const useAddImage = () => useOwnRestaurantMutation(api.addImage);
export const useRemoveImage = () => useOwnRestaurantMutation(api.removeImage);
