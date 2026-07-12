import { ArrowLeft, Lock } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConversationView, UserRole } from '@/lib/api-types';
import { formatClockTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session-store';
import { useChatCache, useMarkConversationRead, useMessages } from '../hooks';
import { useChatSocket } from '../useChatSocket';
import { MessageComposer } from './MessageComposer';

function counterpartName(c: ConversationView, role: UserRole | undefined): string {
  return role === 'CLIENT' ? c.restaurant.name : c.client.fullName;
}

interface MessageThreadProps {
  conversation: ConversationView;
  /** Mobile: return to the conversation list. */
  onBack?: () => void;
}

export function MessageThread({ conversation, onBack }: MessageThreadProps) {
  const conversationId = conversation.id;
  const user = useSessionStore((s) => s.user);
  const meId = user?.id;

  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useMessages(conversationId);
  const { appendMessage, markRead: cacheMarkRead } = useChatCache();
  const markReadMutation = useMarkConversationRead();

  const { send, markRead } = useChatSocket(conversationId, {
    onMessage: (message) => {
      appendMessage(message);
      if (message.senderId !== meId) {
        markRead();
        markReadMutation.mutate(conversationId);
      }
    },
    onRead: (event) => cacheMarkRead(event.conversationId, event.readerId),
  });

  // Clear unread on open (REST for the badge/bell, socket for read-receipts).
  useEffect(() => {
    markReadMutation.mutate(conversationId);
    markRead();
    // markReadMutation.mutate + markRead are stable for a given conversationId;
    // re-running on their identity would mark-read on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Pages are newest-first; flatten and reverse to render oldest → newest.
  const messages = useMemo(() => {
    const flat = data?.pages.flatMap((page) => page.items) ?? [];
    return [...flat].reverse();
  }, [data]);

  // Auto-scroll to the newest message, but not when loading older history.
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lastId]);

  const handleSend = async (content: string): Promise<boolean> => {
    const ack = await send(content);
    if (!ack.success) {
      toast.error(ack.error?.message ?? 'No se pudo enviar el mensaje.');
      return false;
    }
    return true;
  };

  const name = counterpartName(conversation, user?.role);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Volver a conversaciones"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        )}
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{name}</p>
          {!conversation.writable && (
            <p className="flex items-center gap-1 text-xs text-text-muted">
              <Lock className="size-3" aria-hidden="true" />
              Solo lectura
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn('h-10 w-2/3 rounded-2xl', i % 2 === 0 && 'ml-auto')}
              />
            ))}
          </div>
        )}

        {isError && (
          <ErrorState
            title="No pudimos cargar los mensajes"
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && (
          <>
            {hasNextPage && (
              <div className="flex justify-center pb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                >
                  Ver mensajes anteriores
                </Button>
              </div>
            )}
            {messages.length === 0 && (
              <p className="py-10 text-center text-sm text-text-muted">
                No hay mensajes todavía. ¡Escribe el primero!
              </p>
            )}
            {messages.map((message) => {
              const isMine = message.senderId === meId;
              return (
                <div
                  key={message.id}
                  className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                      isMine
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface-raised text-text',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <p
                      className={cn(
                        'mt-1 text-right text-[0.625rem]',
                        isMine ? 'text-primary-foreground/70' : 'text-text-muted',
                      )}
                    >
                      {formatClockTime(message.createdAt)}
                      {isMine && message.readAt ? ' · Leído' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <MessageComposer disabled={!conversation.writable} onSend={handleSend} />
    </div>
  );
}
