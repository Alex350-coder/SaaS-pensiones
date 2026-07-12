import { ErrorState } from '@/components/shared/state-message';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { NoticeType } from '@/lib/api-types';
import { formatDateTime } from '@/lib/format';
import { useNotice } from '../hooks';

const NOTICE_TYPE_LABEL: Record<NoticeType, string> = {
  MENU_CHANGE: 'Cambio de menú',
  SCHEDULE_CHANGE: 'Horario',
  PROMOTION: 'Promoción',
  CLOSURE: 'Cierre',
  GENERAL: 'Aviso',
};

interface NoticeDialogProps {
  noticeId: string | null;
  onClose: () => void;
}

/** Reads a single aviso; opening it clears the matching bell entry server-side. */
export function NoticeDialog({ noticeId, onClose }: NoticeDialogProps) {
  const { data, isLoading, isError, refetch } = useNotice(noticeId);

  return (
    <Dialog
      open={noticeId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {isError && (
          <ErrorState
            title="No pudimos cargar el aviso"
            onRetry={() => refetch()}
          />
        )}
        {data && (
          <>
            <DialogHeader>
              <span className="w-fit rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                {NOTICE_TYPE_LABEL[data.type]}
              </span>
              <DialogTitle>{data.title}</DialogTitle>
              <DialogDescription>
                {'restaurant' in data ? `${data.restaurant.name} · ` : ''}
                {formatDateTime(data.publishedAt)}
              </DialogDescription>
            </DialogHeader>
            <p className="whitespace-pre-line text-sm leading-relaxed text-text">
              {data.body}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
