import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { NotificationView } from '@/lib/api-types';
import { useSocket } from '@/hooks/useSocket';
import { useIsAuthenticated } from '@/stores/session-store';
import * as api from './api';
import { notificationCopy } from './notification-copy';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unread: boolean) =>
    [...notificationKeys.all, 'list', { unread }] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

/** Bell badge count; short stale time so it stays fresh across the app. */
export function useUnreadCount() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: api.getUnreadCount,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

/** First page of notifications for the bell dropdown. */
export function useNotifications(unread = false, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(unread),
    queryFn: () => api.listNotifications({ unread, limit: 10 }),
    enabled,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/**
 * Live bell: subscribe to the `/notifications` push gateway. On each new
 * notification, refresh the badge + list and surface a toast so the user sees
 * it without opening the dropdown.
 */
export function useNotificationsRealtime(): void {
  const queryClient = useQueryClient();
  useSocket('notifications', {
    'notification:new': (payload) => {
      const notification = payload as NotificationView;
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      toast(notificationCopy(notification).title);
    },
  });
}
