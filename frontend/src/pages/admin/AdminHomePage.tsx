import { Store } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeading } from '@/components/shared/page-heading';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorState, StateMessage } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAdminRestaurants,
  useChangeRestaurantStatus,
} from '@/features/admin/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api-client';
import type { RestaurantStatus } from '@/lib/api-types';
import { formatDate } from '@/lib/format';
import { RESTAURANT_STATUS } from '@/lib/status';
import { cn } from '@/lib/utils';

const FILTERS: { value: RestaurantStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobados' },
  { value: 'SUSPENDED', label: 'Suspendidos' },
];

export function AdminHomePage() {
  useDocumentTitle('Restaurantes');
  const [filter, setFilter] = useState<RestaurantStatus | 'ALL'>('ALL');
  const { data, isLoading, isError, refetch } = useAdminRestaurants(
    filter === 'ALL' ? undefined : filter,
  );
  const changeStatus = useChangeRestaurantStatus();
  const restaurants = data?.items ?? [];

  const act = (id: string, status: 'APPROVED' | 'SUSPENDED', label: string) => {
    changeStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`Restaurante ${label}.`),
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : 'No se pudo actualizar.',
          ),
      },
    );
  };

  return (
    <>
      <PageHeading
        title="Restaurantes"
        description="Aprueba, suspende y supervisa los restaurantes de la plataforma."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              filter === f.value
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border text-text-muted hover:border-primary/40',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <Skeleton className="h-64 w-full rounded-lg" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && restaurants.length === 0 && (
        <StateMessage icon={Store} title="Sin restaurantes" />
      )}

      {restaurants.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurante</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Registrado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restaurants.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="font-medium">{r.name}</p>
                    <p className="max-w-xs truncate text-xs text-text-muted">
                      {r.address}
                    </p>
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {r.contactEmail}
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge meta={RESTAURANT_STATUS[r.status]} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {r.status !== 'APPROVED' && (
                        <Button
                          size="sm"
                          loading={changeStatus.isPending}
                          onClick={() =>
                            act(
                              r.id,
                              'APPROVED',
                              r.status === 'PENDING' ? 'aprobado' : 'reactivado',
                            )
                          }
                        >
                          {r.status === 'PENDING' ? 'Aprobar' : 'Reactivar'}
                        </Button>
                      )}
                      {r.status === 'APPROVED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={changeStatus.isPending}
                          onClick={() => act(r.id, 'SUSPENDED', 'suspendido')}
                        >
                          Suspender
                        </Button>
                      )}
                    </div>
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
