import { useQuery } from '@tanstack/react-query';
import * as api from './api';

export const restaurantReservationKeys = {
  all: ['restaurant-reservations'] as const,
  day: (date: string) => [...restaurantReservationKeys.all, 'day', date] as const,
  projection: (date: string) =>
    [...restaurantReservationKeys.all, 'projection', date] as const,
};

export function useDayReservations(date: string) {
  return useQuery({
    queryKey: restaurantReservationKeys.day(date),
    queryFn: () => api.listDayReservations({ date }),
  });
}

export function useProjection(date: string) {
  return useQuery({
    queryKey: restaurantReservationKeys.projection(date),
    queryFn: () => api.getProjection(date),
  });
}
