import { apiFetch, type Paginated } from '@/lib/api-client';
import type {
  ConversationView,
  MessagePage,
  MessageView,
} from '@/lib/api-types';

export function openConversation(pensionId: string): Promise<ConversationView> {
  return apiFetch<ConversationView>('/conversations', {
    method: 'POST',
    body: { pensionId },
  });
}

export function listConversations({
  page = 1,
  limit = 20,
}: { page?: number; limit?: number } = {}): Promise<
  Paginated<ConversationView>
> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<Paginated<ConversationView>>(
    `/conversations/mine?${query.toString()}`,
  );
}

export function getMessages(
  conversationId: string,
  { cursor, limit = 30 }: { cursor?: string; limit?: number } = {},
): Promise<MessagePage> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return apiFetch<MessagePage>(
    `/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`,
  );
}

/** REST send — a fallback when the socket is unavailable; the gateway is the
 *  primary path (it broadcasts `message:new` to the room). */
export function sendMessage(
  conversationId: string,
  content: string,
): Promise<MessageView> {
  return apiFetch<MessageView>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: 'POST', body: { content } },
  );
}

export function markConversationRead(
  conversationId: string,
): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>(
    `/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: 'POST' },
  );
}
