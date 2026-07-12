import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PensionStatus } from '@/lib/api-types';
import * as api from './api';

export const pensionKeys = {
  all: ['pensions'] as const,
  list: (status?: PensionStatus) =>
    [...pensionKeys.all, 'list', status ?? 'all'] as const,
  detail: (id: string) => [...pensionKeys.all, 'detail', id] as const,
};

export function useMyPensions(status?: PensionStatus) {
  return useQuery({
    queryKey: pensionKeys.list(status),
    queryFn: () => api.listMyPensions({ status }),
  });
}

export function useMyPension(id: string | null) {
  return useQuery({
    queryKey: pensionKeys.detail(id ?? ''),
    queryFn: () => api.getMyPension(id as string),
    enabled: Boolean(id),
  });
}

export function useContractPension() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.contractPension,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: pensionKeys.all }),
  });
}

export function useCancelPension() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.cancelPension,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: pensionKeys.all }),
  });
}
