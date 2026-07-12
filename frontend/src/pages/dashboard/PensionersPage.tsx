import { Users } from 'lucide-react';
import { useState } from 'react';
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
import { PensionManageDialog } from '@/features/restaurant-pensions/components/PensionManageDialog';
import { useRestaurantPensions } from '@/features/restaurant-pensions/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { PensionStatus } from '@/lib/api-types';
import { formatCurrency, formatDate } from '@/lib/format';
import { PENSION_STATUS } from '@/lib/status';
import { cn } from '@/lib/utils';

const FILTERS: { value: PensionStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'PENDING_PAYMENT', label: 'Por pagar' },
  { value: 'ACTIVE', label: 'Activas' },
  { value: 'SUSPENDED', label: 'Suspendidas' },
  { value: 'EXPIRED', label: 'Vencidas' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

export function PensionersPage() {
  useDocumentTitle('Pensionarios');
  const [filter, setFilter] = useState<PensionStatus | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useRestaurantPensions(
    filter === 'ALL' ? undefined : filter,
  );
  const pensions = data?.items ?? [];

  return (
    <>
      <PageHeading
        title="Pensionarios"
        description="Gestiona pensiones, registra pagos y controla vencimientos."
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

      {!isLoading && !isError && pensions.length === 0 && (
        <StateMessage
          icon={Users}
          title="Sin pensionarios"
          description="Cuando un cliente contrate una pensión aparecerá aquí."
        />
      )}

      {pensions.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Días</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Gestionar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pensions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.client.fullName}</p>
                    <p className="text-xs text-text-muted">{p.client.email}</p>
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {formatDate(p.startDate)} – {formatDate(p.endDate)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(p.price)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {p.status === 'ACTIVE' ? p.daysRemaining : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge meta={PENSION_STATUS[p.status]} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedId(p.id)}
                    >
                      Gestionar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PensionManageDialog
        pensionId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
