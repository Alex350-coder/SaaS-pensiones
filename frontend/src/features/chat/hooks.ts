import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { notificationKeys } from '@/features/notifications/hooks';
import type { MessagePage, MessageView } from '@/lib/api-types';
import * as api from './api';

export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  messages: (id: string) => [...chatKeys.all, 'messages', id] as const,
};

/** The caller's conversations, newest activity first. */
export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations(),
    queryFn: () => api.listConversations({ limit: 20 }),
  });
}

/**
 * Marks a conversation read (clears my unread badge + the NEW_MESSAGE bell
 * entry server-side). Complements the socket read-receipt; both are idempotent.
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markConversationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** Keyset-paginated history (newest first); `fetchNextPage` walks older. */
export function useMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId ?? ''),
    queryFn: ({ pageParam }) =>
      api.getMessages(conversationId as string, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(conversationId),
  });
}

/**
 * Cache mutators for live socket events. Keeping realtime updates in the
 * TanStack cache (rather than local state) dedupes by id and survives
 * remounts as the user switches conversations.
 */
export function useChatCache() {
  const queryClient = useQueryClient();

  const appendMessage = useCallback(
    (message: MessageView) => {
      queryClient.setQueryData<InfiniteData<MessagePage>>(
        chatKeys.messages(message.conversationId),
        (old) => {
          if (!old) return old;
          const exists = old.pages.some((page) =>
            page.items.some((item) => item.id === message.id),
          );
          if (exists) return old;
          const [first, ...rest] = old.pages;
          // Pages are newest-first: the newest message goes at the head.
          return {
            ...old,
            pages: [{ ...first, items: [message, ...first.items] }, ...rest],
          };
        },
      );
      // Bump the conversation list (last message + ordering).
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
    [queryClient],
  );

  const markRead = useCallback(
    (conversationId: string, readerId: string) => {
      const now = new Date().toISOString();
      queryClient.setQueryData<InfiniteData<MessagePage>>(
        chatKeys.messages(conversationId),
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.map((item) =>
                    // The reader marked the *other* party's messages read.
                    item.senderId !== readerId && item.readAt === null
                      ? { ...item, readAt: now }
                      : item,
                  ),
                })),
              }
            : old,
      );
    },
    [queryClient],
  );

  const invalidateConversations = useCallback(
    () => queryClient.invalidateQueries({ queryKey: chatKeys.conversations() }),
    [queryClient],
  );

  return { appendMessage, markRead, invalidateConversations };
}
