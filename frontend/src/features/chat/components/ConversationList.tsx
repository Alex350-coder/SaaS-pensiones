import { MessageSquare } from 'lucide-react';
import { ErrorState, StateMessage } from '@/components/shared/state-message';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConversationView, UserRole } from '@/lib/api-types';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session-store';
import { useConversations } from '../hooks';

/** Who the current user is talking to depends on their side of the pension. */
function counterpartName(c: ConversationView, role: UserRole | undefined): string {
  return role === 'CLIENT' ? c.restaurant.name : c.client.fullName;
}

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (conversation: ConversationView) => void;
}

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const role = useSessionStore((s) => s.user?.role);
  const { data, isLoading, isError, refetch } = useConversations();
  const items = data?.items ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-text">Conversaciones</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <ErrorState
            title="No pudimos cargar tus chats"
            onRetry={() => refetch()}
            className="m-4"
          />
        )}

        {!isLoading && !isError && items.length === 0 && (
          <StateMessage
            icon={MessageSquare}
            title="Sin conversaciones"
            description={
              role === 'CLIENT'
                ? 'Cuando contrates una pensión podrás chatear con el restaurante.'
                : 'Aquí aparecerán los chats con tus pensionarios.'
            }
            className="m-4 border-0"
          />
        )}

        {items.length > 0 && (
          <ul>
            {items.map((c) => {
              const name = counterpartName(c, role);
              const isSelected = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    aria-current={isSelected}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:bg-surface-raised',
                      isSelected && 'bg-primary-soft/50',
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-text">
                          {name}
                        </span>
                        {c.lastMessage && (
                          <span className="shrink-0 text-xs text-text-muted">
                            {formatRelativeTime(c.lastMessage.createdAt)}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-text-muted">
                          {c.lastMessage?.content ?? 'Sin mensajes aún'}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                            {c.unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
