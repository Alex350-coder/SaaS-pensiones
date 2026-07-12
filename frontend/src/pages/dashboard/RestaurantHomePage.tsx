import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '@/components/shared/page-heading';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorState, StateMessage } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/features/dashboard/hooks';
import { useExpiringPensions } from '@/features/restaurant-pensions/hooks';
import {
  isNoRestaurant,
  useOwnRestaurant,
} from '@/features/restaurant-profile/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { OwnerRestaurantView } from '@/lib/api-types';
import { formatCurrency, formatDate } from '@/lib/format';
import { RESTAURANT_STATUS } from '@/lib/status';

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-text tabular-nums">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

function DashboardContent({ restaurant }: { restaurant: OwnerRestaurantView }) {
  const { data, isLoading, isError, refetch } = useDashboard();
  const expiring = useExpiringPensions(3);

  return (
    <div className="space-y-6">
      {restaurant.status !== 'APPROVED' && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-text">
            Tu restaurante está{' '}
            <StatusBadge meta={RESTAURANT_STATUS[restaurant.status]} /> y no
            aparece en el catálogo público hasta que un administrador lo apruebe.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile
              icon={Users}
              label="Pensionarios activos"
              value={String(data.activePensioners)}
            />
            <StatTile
              icon={Wallet}
              label="Pagos pendientes"
              value={formatCurrency(data.pendingPayments.amount)}
              hint={`${data.pendingPayments.count} pensión(es) por cobrar`}
            />
            <StatTile
              icon={ClipboardList}
              label="Reservas de hoy"
              value={String(data.todayReservations)}
            />
            <StatTile
              icon={CalendarClock}
              label="Asistencia proyectada"
              value={String(data.projectedAttendance)}
              hint="Confirmados + sin responder"
            />
            <StatTile
              icon={TrendingUp}
              label="Ingresos estimados"
              value={formatCurrency(data.estimatedRevenue)}
              hint="Pensiones activas"
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Pensiones por vencer (3 días)</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/panel/pensionarios">Ver todas</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {expiring.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (expiring.data?.items.length ?? 0) === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">
                  No hay pensiones próximas a vencer.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {expiring.data?.items.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 py-2.5 text-sm"
                    >
                      <span className="min-w-0 truncate text-text">
                        {p.client.fullName}
                      </span>
                      <span className="shrink-0 text-text-muted">
                        vence {formatDate(p.endDate)} · {p.daysRemaining} días
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export function RestaurantHomePage() {
  useDocumentTitle('Resumen del restaurante');
  const own = useOwnRestaurant();

  return (
    <>
      <PageHeading
        title="Resumen"
        description="Métricas de tu restaurante en tiempo real."
      />
      {own.isLoading && <Skeleton className="h-64 w-full rounded-lg" />}
      {own.isError && isNoRestaurant(own.error) && (
        <StateMessage
          icon={Store}
          title="Crea tu restaurante"
          description="Aún no registraste tu restaurante. Créalo para empezar a gestionar menús, pensionarios y más."
          action={
            <Button asChild>
              <Link to="/panel/restaurante">Crear restaurante</Link>
            </Button>
          }
        />
      )}
      {own.isError && !isNoRestaurant(own.error) && (
        <ErrorState onRetry={() => own.refetch()} />
      )}
      {own.data && <DashboardContent restaurant={own.data} />}
    </>
  );
}
