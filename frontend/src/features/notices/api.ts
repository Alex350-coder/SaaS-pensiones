import { apiFetch, type Paginated } from '@/lib/api-client';
import type {
  ClientNoticeView,
  NoticeType,
  OwnerNoticeView,
} from '@/lib/api-types';

export interface PublishNoticeInput {
  title: string;
  body: string;
  type?: NoticeType;
}

/** Owner: publish an aviso (fans out to ACTIVE pensioners). */
export function publishNotice(
  input: PublishNoticeInput,
): Promise<OwnerNoticeView & { recipientCount: number }> {
  return apiFetch<OwnerNoticeView & { recipientCount: number }>(
    '/restaurants/mine/notices',
    { method: 'POST', body: input },
  );
}

/** Owner: history of published avisos with read stats. */
export function listMyNotices({
  page = 1,
  limit = 30,
}: { page?: number; limit?: number } = {}): Promise<Paginated<OwnerNoticeView>> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<Paginated<OwnerNoticeView>>(
    `/restaurants/mine/notices?${query.toString()}`,
  );
}

/**
 * Notice detail for the current user. Opening it server-side stamps the notice
 * as read and clears its bell entry (see NoticesService.getForUser). The owner
 * variant carries `readCount`; the recipient variant carries `restaurant`.
 */
export function getNotice(
  id: string,
): Promise<OwnerNoticeView | ClientNoticeView> {
  return apiFetch<OwnerNoticeView | ClientNoticeView>(
    `/notices/${encodeURIComponent(id)}`,
  );
}
