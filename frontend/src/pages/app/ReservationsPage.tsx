import { CalendarCheck, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeading } from '@/components/shared/page-heading';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorState, StateMessage } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { MenuCourseList } from '@/features/menus/components/MenuCourseList';
import { isMenuNotFound, usePublicMenu } from '@/features/menus/hooks';
import { useMyPensions } from '@/features/pensions/hooks';
import {
  useCancelReservation,
  useCreateReservation,
  useMyReservations,
} from '@/features/reservations/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import { RESERVATION_STATUS } from '@/lib/status';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export function ReservationsPage() {
  useDocumentTitle('Reservas');
  const { data: pensions, isLoading: pensionsLoading } = useMyPensions('ACTIVE');
  const active = pensions?.items[0] ?? null;

  const [date, setDate] = useState(todayIso());
  const [arrival, setArrival] = useState('12:30');
  const [notes, setNotes] = useState('');

  const menu = usePublicMenu(active?.restaurant.slug, date);
  const { data: reservationsData } = useMyReservations();
  const reservations = reservationsData?.items ?? [];
  const existing = reservations.find(
    (r) => r.menuDate === date && r.status === 'CONFIRMED',
  );

  const createReservation = useCreateReservation();
  const cancelReservation = useCancelReservation();

  const handleReserve = () => {
    if (!menu.data) return;
    createReservation.mutate(
      {
        dailyMenuId: menu.data.id,
        estimatedArrival: arrival,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Reserva confirmada.');
          setNotes('');
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : 'No se pudo reservar.',
          ),
      },
    );
  };

  const handleCancel = (id: string) => {
    cancelReservation.mutate(id, {
      onSuccess: () => toast.success('Reserva cancelada.'),
      onError: (error) =>
        toast.error(
          error instanceof ApiError ? error.message : 'No se pudo cancelar.',
        ),
    });
  };

  if (pensionsLoading) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  if (!active) {
    return (
      <>
        <PageHeading title="Reservas" />
        <StateMessage
          icon={UtensilsCrossed}
          title="Necesitas una pensión activa"
          description="Reservar el menú del día requiere una pensión activa en un restaurante."
          action={
            <Button asChild>
              <Link to="/app">Ir a mi pensión</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeading
        title="Reservas"
        description={`Reserva el menú del día en ${active.restaurant.name}.`}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reservar menú</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="reserve-date">Fecha</Label>
                <Input
                  id="reserve-date"
                  type="date"
                  min={todayIso()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {menu.isLoading && <Skeleton className="h-40 w-full" />}
              {menu.isError && isMenuNotFound(menu.error) && (
                <StateMessage
                  icon={UtensilsCrossed}
                  title="Sin menú publicado"
                  description="El restaurante no publicó menú para esta fecha."
                  className="border-0"
                />
              )}
              {menu.isError && !isMenuNotFound(menu.error) && (
                <ErrorState onRetry={() => menu.refetch()} />
              )}

              {menu.data && (
                <>
                  <MenuCourseList items={menu.data.items} />
                  <div className="flex items-center justify-between rounded-md bg-surface-raised px-4 py-3">
                    <span className="text-sm font-medium text-text-muted">
                      Precio del menú
                    </span>
                    <span className="text-lg font-bold text-primary tabular-nums">
                      {formatCurrency(menu.data.menuPrice)}
                    </span>
                  </div>

                  {existing ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-success/30 bg-success-soft px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-text">
                        <CalendarCheck className="size-4 text-success" aria-hidden="true" />
                        Ya reservaste este menú (llegada {existing.estimatedArrival}).
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={cancelReservation.isPending}
                        onClick={() => handleCancel(existing.id)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 border-t border-border pt-4">
                      <div className="max-w-xs space-y-1.5">
                        <Label htmlFor="arrival">Hora estimada de llegada</Label>
                        <Input
                          id="arrival"
                          type="time"
                          value={arrival}
                          onChange={(e) => setArrival(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="notes">Notas (opcional)</Label>
                        <Textarea
                          id="notes"
                          maxLength={255}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ej. sin ají, mesa para dos…"
                          className="resize-none"
                        />
                      </div>
                      <Button
                        loading={createReservation.isPending}
                        onClick={handleReserve}
                      >
                        <CalendarCheck aria-hidden="true" />
                        Reservar
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mis reservas</CardTitle>
            </CardHeader>
            <CardContent>
              {reservations.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">
                  Aún no tienes reservas.
                </p>
              ) : (
                <ul className="space-y-3">
                  {reservations.map((r) => {
                    const cancellable =
                      r.status === 'CONFIRMED' && r.menuDate >= todayIso();
                    return (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text">
                            {formatDate(r.menuDate)}
                          </p>
                          <p className="text-xs text-text-muted">
                            Llegada {r.estimatedArrival}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge meta={RESERVATION_STATUS[r.status]} />
                          {cancellable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(r.id)}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
