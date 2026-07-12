import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PensionStatus } from '@/lib/api-types';
import type { RegisterPaymentInput } from './api';
import * as api from './api';

export const restaurantPensionKeys = {
  all: ['restaurant-pensions'] as const,
  list: (status?: PensionStatus) =>
    [...restaurantPensionKeys.all, 'list', status ?? 'all'] as const,
  expiring: (days: number) =>
    [...restaurantPensionKeys.all, 'expiring', days] as const,
  detail: (id: string) => [...restaurantPensionKeys.all, 'detail', id] as const,
};

export function useRestaurantPensions(status?: PensionStatus) {
  return useQuery({
    queryKey: restaurantPensionKeys.list(status),
    queryFn: () => api.listRestaurantPensions({ status }),
  });
}

export function useExpiringPensions(days = 3) {
  return useQuery({
    queryKey: restaurantPensionKeys.expiring(days),
    queryFn: () => api.listExpiringPensions(days),
  });
}

export function useRestaurantPension(id: string | null) {
  return useQuery({
    queryKey: restaurantPensionKeys.detail(id ?? ''),
    queryFn: () => api.getRestaurantPension(id as string),
    enabled: Boolean(id),
  });
}

function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: restaurantPensionKeys.all });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useRegisterPayment() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RegisterPaymentInput }) =>
      api.registerPayment(id, input),
    onSuccess: invalidate,
  });
}

export function useChangePensionStatus() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
    }) => api.changePensionStatus(id, status),
    onSuccess: invalidate,
  });
}
