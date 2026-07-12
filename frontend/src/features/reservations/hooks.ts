import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

export const reservationKeys = {
  all: ['reservations'] as const,
  mine: () => [...reservationKeys.all, 'mine'] as const,
};

export function useMyReservations() {
  return useQuery({
    queryKey: reservationKeys.mine(),
    queryFn: () => api.listMyReservations({ limit: 30 }),
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createReservation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.cancelReservation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
  });
}
