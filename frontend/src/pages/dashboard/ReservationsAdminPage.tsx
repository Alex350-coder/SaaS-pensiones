import { CalendarCheck } from 'lucide-react';
import { useState } from 'react';
import { PageHeading } from '@/components/shared/page-heading';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorState } from '@/components/shared/state-message';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  useDayReservations,
  useProjection,
} from '@/features/restaurant-reservations/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { RESERVATION_STATUS } from '@/lib/status';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold text-text tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function ReservationsAdminPage() {
  useDocumentTitle('Reservas y asistencia');
  const [date, setDate] = useState(todayIso());
  const projection = useProjection(date);
  const reservations = useDayReservations(date);

  const p = projection.data;
  const rows = reservations.data?.items ?? [];

  return (
    <>
      <PageHeading
        title="Reservas y asistencia"
        description="Proyección de producción y reservas del día para planificar tu cocina."
      />

      <div className="mb-6 max-w-xs space-y-1.5">
        <Label htmlFor="proj-date">Día</Label>
        <Input
          id="proj-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {projection.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : projection.isError ? (
        <ErrorState onRetry={() => projection.refetch()} />
      ) : p ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Pensionarios activos" value={p.pensioners.active} />
          <Metric label="Asistirán" value={p.attendance.willAttend} />
          <Metric label="Sin responder" value={p.pensioners.unanswered} />
          <Metric label="Asistencia proyectada" value={p.projectedAttendance} />
        </div>
      ) : null}

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text">
          <CalendarCheck className="size-5 text-primary" aria-hidden="true" />
          Reservas del día
        </h2>
        {reservations.isLoading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : reservations.isError ? (
          <ErrorState onRetry={() => reservations.refetch()} />
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-text-muted">
            No hay reservas para esta fecha.
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Llegada</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.client.fullName}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.estimatedArrival}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-text-muted">
                      {r.notes ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge meta={RESERVATION_STATUS[r.status]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
