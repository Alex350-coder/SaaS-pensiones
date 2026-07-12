import { CalendarCheck, ClipboardCheck, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '@/components/shared/page-heading';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorState, StateMessage } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PensionDetailCard } from '@/features/pensions/components/PensionDetailCard';
import { useMyPensions } from '@/features/pensions/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { PensionView } from '@/lib/api-types';
import { formatDate } from '@/lib/format';
import { PENSION_STATUS } from '@/lib/status';

/** The pension to feature: prefer active, then pending, then most recent. */
function pickCurrent(pensions: PensionView[]): PensionView | null {
  return (
    pensions.find((p) => p.status === 'ACTIVE') ??
    pensions.find((p) => p.status === 'PENDING_PAYMENT') ??
    pensions[0] ??
    null
  );
}

export function ClientHomePage() {
  useDocumentTitle('Mi pensión');
  const { data, isLoading, isError, refetch } = useMyPensions();

  const pensions = data?.items ?? [];
  const current = pickCurrent(pensions);
  const others = pensions.filter((p) => p.id !== current?.id);
  const isActive = current?.status === 'ACTIVE';

  return (
    <>
      <PageHeading
        title="Mi pensión"
        description="El estado de tu plan, tus pagos y tus acciones del día."
      />

      {isLoading && <Skeleton className="h-80 w-full rounded-lg" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && !current && (
        <StateMessage
          icon={UtensilsCrossed}
          title="Aún no tienes una pensión"
          description="Explora los restaurantes y contrata tu plan de comidas de 30 días."
          action={
            <Button asChild>
              <Link to="/restaurantes">Explorar restaurantes</Link>
            </Button>
          }
        />
      )}

      {current && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PensionDetailCard pensionId={current.id} />
          </div>

          <div className="space-y-6">
            {isActive && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Acciones del día</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Button variant="secondary" className="justify-start" asChild>
                    <Link to="/app/reservas">
                      <CalendarCheck aria-hidden="true" />
                      Reservar menú
                    </Link>
                  </Button>
                  <Button variant="secondary" className="justify-start" asChild>
                    <Link to="/app/asistencia">
                      <ClipboardCheck aria-hidden="true" />
                      Confirmar asistencia
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {others.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historial</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {others.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text">
                          {p.restaurant.name}
                        </p>
                        <p className="text-xs text-text-muted">
                          {formatDate(p.startDate)} – {formatDate(p.endDate)}
                        </p>
                      </div>
                      <StatusBadge meta={PENSION_STATUS[p.status]} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
