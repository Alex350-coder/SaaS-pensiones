import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { notificationKeys } from '@/features/notifications/hooks';
import * as api from './api';

export const noticeKeys = {
  all: ['notices'] as const,
  detail: (id: string) => [...noticeKeys.all, 'detail', id] as const,
  mine: () => [...noticeKeys.all, 'mine'] as const,
};

export function useMyNotices() {
  return useQuery({
    queryKey: noticeKeys.mine(),
    queryFn: () => api.listMyNotices(),
  });
}

export function usePublishNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.publishNotice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noticeKeys.mine() }),
  });
}

/**
 * Notice detail. Fetching it also clears the matching bell entry on the server,
 * so once loaded we refresh the notification queries to reflect the new count.
 */
export function useNotice(id: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: noticeKeys.detail(id ?? ''),
    queryFn: () => api.getNotice(id as string),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (query.isSuccess) {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    }
  }, [query.isSuccess, queryClient]);

  return query;
}
