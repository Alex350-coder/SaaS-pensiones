import { apiFetch, type Paginated } from '@/lib/api-client';
import type { NotificationView } from '@/lib/api-types';

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  unread?: boolean;
}

export function listNotifications({
  page = 1,
  limit = 10,
  unread,
}: ListNotificationsParams = {}): Promise<Paginated<NotificationView>> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (unread) query.set('unread', 'true');
  return apiFetch<Paginated<NotificationView>>(
    `/notifications?${query.toString()}`,
  );
}

export function getUnreadCount(): Promise<{ unread: number }> {
  return apiFetch<{ unread: number }>('/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<NotificationView> {
  return apiFetch<NotificationView>(
    `/notifications/${encodeURIComponent(id)}/read`,
    { method: 'POST' },
  );
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/notifications/read-all', {
    method: 'POST',
  });
}
