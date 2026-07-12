import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

export const attendanceKeys = {
  all: ['attendance'] as const,
  mine: (pensionId: string) => [...attendanceKeys.all, 'mine', pensionId] as const,
};

export function useMyAttendance(pensionId: string | null) {
  return useQuery({
    queryKey: attendanceKeys.mine(pensionId ?? ''),
    queryFn: () => api.listMyAttendance({ pensionId: pensionId as string }),
    enabled: Boolean(pensionId),
  });
}

export function useConfirmAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.confirmAttendance,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
}
