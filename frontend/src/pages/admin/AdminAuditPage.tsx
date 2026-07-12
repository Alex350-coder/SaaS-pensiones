import { ScrollText } from 'lucide-react';
import { PageHeading } from '@/components/shared/page-heading';
import { ErrorState, StateMessage } from '@/components/shared/state-message';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuditEvents } from '@/features/admin/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDateTime } from '@/lib/format';

export function AdminAuditPage() {
  useDocumentTitle('Auditoría');
  const { data, isLoading, isError, refetch } = useAuditEvents();
  const events = data?.items ?? [];

  return (
    <>
      <PageHeading
        title="Auditoría"
        description="Eventos de autenticación registrados en el sistema (más recientes primero)."
      />

      {isLoading && <Skeleton className="h-64 w-full rounded-lg" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && events.length === 0 && (
        <StateMessage icon={ScrollText} title="Sin eventos" />
      )}

      {events.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.action}</TableCell>
                  <TableCell className="font-mono text-xs text-text-muted">
                    {e.actorId ?? '—'}
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {formatDateTime(e.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
