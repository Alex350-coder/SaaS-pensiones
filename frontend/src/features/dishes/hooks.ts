import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DishInput } from './api';
import * as api from './api';

export const dishKeys = {
  all: ['dishes'] as const,
  list: () => [...dishKeys.all, 'list'] as const,
};

export function useDishes() {
  return useQuery({
    queryKey: dishKeys.list(),
    queryFn: () => api.listDishes(),
  });
}

export function useCreateDish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createDish,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dishKeys.all }),
  });
}

export function useUpdateDish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<DishInput> }) =>
      api.updateDish(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dishKeys.all }),
  });
}

export function useDeleteDish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteDish,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dishKeys.all }),
  });
}
