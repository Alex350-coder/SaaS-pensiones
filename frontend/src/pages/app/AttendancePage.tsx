import { Check, ClipboardCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeading } from '@/components/shared/page-heading';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { StateMessage } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyAttendance } from '@/features/attendance/hooks';
import type { ConfirmableStatus } from '@/features/attendance/api';
import { useConfirmAttendance } from '@/features/attendance/hooks';
import { useMyPensions } from '@/features/pensions/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api-client';
import type { AttendanceStatus } from '@/lib/api-types';
import { formatDate } from '@/lib/format';
import { ATTENDANCE_STATUS } from '@/lib/status';

const HORIZON_DAYS = 13;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateRange(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  for (let d = startIso; d <= endIso; d = addDays(d, 1)) out.push(d);
  return out;
}

const dayLabel = (iso: string): string => {
  const date = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat('es-PE', { weekday: 'long' }).format(date);
};

export function AttendancePage() {
  useDocumentTitle('Asistencia');
  const { data: pensions, isLoading } = useMyPensions('ACTIVE');
  const active = pensions?.items[0] ?? null;
  const attendance = useMyAttendance(active?.id ?? null);
  const confirm = useConfirmAttendance();

  if (isLoading) return <Skeleton className="h-96 w-full rounded-lg" />;

  if (!active) {
    return (
      <>
        <PageHeading title="Asistencia" />
        <StateMessage
          icon={ClipboardCheck}
          title="Necesitas una pensión activa"
          description="Confirmar tu asistencia diaria requiere una pensión activa."
          action={
            <Button asChild>
              <Link to="/app">Ir a mi pensión</Link>
            </Button>
          }
        />
      </>
    );
  }

  const from = active.startDate > todayIso() ? active.startDate : todayIso();
  const horizonEnd = addDays(from, HORIZON_DAYS);
  const to = active.endDate < horizonEnd ? active.endDate : horizonEnd;
  const days = dateRange(from, to);

  const byDate = new Map(
    (attendance.data?.items ?? []).map((a) => [a.date, a.status]),
  );

  const setStatus = (date: string, status: ConfirmableStatus) => {
    confirm.mutate(
      { pensionId: active.id, date, status },
      {
        onError: (error) =>
          toast.error(
            error instanceof ApiError
              ? error.message
              : 'No se pudo registrar tu respuesta.',
          ),
      },
    );
  };

  const isPending = (date: string): boolean =>
    confirm.isPending && confirm.variables?.date === date;

  return (
    <>
      <PageHeading
        title="Asistencia"
        description={`Confirma si asistirás cada día en ${active.restaurant.name}. Ayuda al restaurante a planificar su producción.`}
      />
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {days.map((date) => {
              const status: AttendanceStatus | undefined = byDate.get(date);
              const editable =
                status === undefined ||
                status === 'WILL_ATTEND' ||
                status === 'WILL_NOT_ATTEND';
              return (
                <li
                  key={date}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
                >
                  <div>
                    <p className="text-sm font-medium capitalize text-text">
                      {dayLabel(date)}
                    </p>
                    <p className="text-xs text-text-muted">{formatDate(date)}</p>
                  </div>

                  {editable ? (
                    <div className="flex gap-2">
                      <Button
                        variant={status === 'WILL_ATTEND' ? 'primary' : 'outline'}
                        size="sm"
                        loading={isPending(date)}
                        onClick={() => setStatus(date, 'WILL_ATTEND')}
                      >
                        <Check aria-hidden="true" />
                        Asistiré
                      </Button>
                      <Button
                        variant={
                          status === 'WILL_NOT_ATTEND' ? 'secondary' : 'outline'
                        }
                        size="sm"
                        loading={isPending(date)}
                        onClick={() => setStatus(date, 'WILL_NOT_ATTEND')}
                      >
                        <X aria-hidden="true" />
                        No asistiré
                      </Button>
                    </div>
                  ) : (
                    status && <StatusBadge meta={ATTENDANCE_STATUS[status]} />
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
