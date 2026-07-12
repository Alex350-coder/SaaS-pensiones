import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RestaurantStatus, UserRole, UserStatus } from '@/lib/api-types';
import * as api from './api';

export const adminKeys = {
  restaurants: (status?: RestaurantStatus) =>
    ['admin', 'restaurants', status ?? 'all'] as const,
  users: (role?: UserRole, status?: UserStatus) =>
    ['admin', 'users', role ?? 'all', status ?? 'all'] as const,
  audit: () => ['admin', 'audit'] as const,
};

export function useAdminRestaurants(status?: RestaurantStatus) {
  return useQuery({
    queryKey: adminKeys.restaurants(status),
    queryFn: () => api.listAdminRestaurants({ status }),
  });
}

export function useChangeRestaurantStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'APPROVED' | 'SUSPENDED';
    }) => api.changeRestaurantStatus(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] }),
  });
}

export function useAdminUsers(role?: UserRole, status?: UserStatus) {
  return useQuery({
    queryKey: adminKeys.users(role, status),
    queryFn: () => api.listAdminUsers({ role, status }),
  });
}

export function useChangeUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      api.changeUserStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useAuditEvents() {
  return useQuery({
    queryKey: adminKeys.audit(),
    queryFn: () => api.listAuditEvents(),
  });
}
