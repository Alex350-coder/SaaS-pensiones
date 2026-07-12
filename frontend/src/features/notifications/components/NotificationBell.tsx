import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StateMessage } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { NoticeDialog } from '@/features/notices/components/NoticeDialog';
import type { NotificationView } from '@/lib/api-types';
import { formatRelativeTime } from '@/lib/format';
import { messagesPath } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session-store';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationsRealtime,
  useUnreadCount,
} from '../hooks';
import {
  notificationConversationId,
  notificationCopy,
  notificationNoticeId,
} from '../notification-copy';

function NotificationRow({
  notification,
  onSelect,
}: {
  notification: NotificationView;
  onSelect: (n: NotificationView) => void;
}) {
  const { icon: Icon, title, description } = notificationCopy(notification);
  const isUnread = notification.readAt === null;

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:bg-surface-raised',
        isUnread && 'bg-primary-soft/40',
      )}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-text-muted">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text">{title}</span>
          {isUnread && (
            <span
              className="size-2 shrink-0 rounded-full bg-primary"
              aria-label="No leída"
            />
          )}
        </span>
        {description && (
          <span className="block truncate text-xs text-text-muted">
            {description}
          </span>
        )}
        <span className="mt-0.5 block text-xs text-text-muted">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </span>
    </button>
  );
}

/** The bell: unread badge, live push (toast + refresh), and a dropdown list. */
export function NotificationBell() {
  const navigate = useNavigate();
  const role = useSessionStore((s) => s.user?.role);
  const [open, setOpen] = useState(false);
  const [noticeId, setNoticeId] = useState<string | null>(null);

  useNotificationsRealtime();
  const unread = useUnreadCount();
  const list = useNotifications(false, open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const unreadCount = unread.data?.unread ?? 0;
  const items = list.data?.items ?? [];

  const handleSelect = (n: NotificationView) => {
    if (n.readAt === null) markRead.mutate(n.id);
    setOpen(false);

    const conversationId = notificationConversationId(n);
    if (conversationId && role) {
      const path = messagesPath(role);
      if (path) navigate(`${path}?c=${conversationId}`);
      return;
    }
    const openNoticeId = notificationNoticeId(n);
    if (openNoticeId) setNoticeId(openNoticeId);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              unreadCount > 0
                ? `Notificaciones, ${unreadCount} sin leer`
                : 'Notificaciones'
            }
          >
            <Bell aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold leading-4 text-primary-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-[22rem] p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-text">Notificaciones</p>
            <Button
              variant="ghost"
              size="sm"
              disabled={unreadCount === 0 || markAll.isPending}
              loading={markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              <CheckCheck aria-hidden="true" />
              Marcar todas
            </Button>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {list.isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <StateMessage
                icon={Bell}
                title="Sin notificaciones"
                description="Aquí verás avisos, mensajes y vencimientos."
                className="border-0 py-10"
              />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li key={n.id}>
                    <NotificationRow notification={n} onSelect={handleSelect} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <NoticeDialog noticeId={noticeId} onClose={() => setNoticeId(null)} />
    </>
  );
}
