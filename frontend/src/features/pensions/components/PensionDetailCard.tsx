import { CalendarDays, CalendarX2, Clock, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorState } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS, PENSION_STATUS } from '@/lib/status';
import { cn } from '@/lib/utils';
import { useCancelPension, useMyPension } from '../hooks';

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface-raised/50 p-3">
      <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-[1.125rem]" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-sm font-semibold text-text">{value}</p>
      </div>
    </div>
  );
}

export function PensionDetailCard({ pensionId }: { pensionId: string }) {
  const { data, isLoading, isError, refetch } = useMyPension(pensionId);
  const cancel = useCancelPension();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-80 w-full rounded-lg" />;
  if (isError || !data)
    return <ErrorState title="No pudimos cargar tu pensión" onRetry={() => refetch()} />;

  const paidPct =
    data.price > 0 ? Math.min(100, Math.round((data.paidTotal / data.price) * 100)) : 0;
  const canCancel = data.status === 'PENDING_PAYMENT';

  const handleCancel = () => {
    cancel.mutate(pensionId, {
      onSuccess: () => {
        toast.success('Pensión cancelada.');
        setConfirmOpen(false);
      },
      onError: (error) =>
        toast.error(
          error instanceof ApiError ? error.message : 'No se pudo cancelar.',
        ),
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-text">{data.restaurant.name}</p>
          <p className="text-sm text-text-muted">Plan mensual · 30 días</p>
        </div>
        <StatusBadge meta={PENSION_STATUS[data.status]} />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat
            icon={Clock}
            label="Días restantes"
            value={
              data.status === 'ACTIVE' ? `${data.daysRemaining} días` : '—'
            }
          />
          <Stat icon={Wallet} label="Precio del plan" value={formatCurrency(data.price)} />
          <Stat icon={CalendarDays} label="Inicio" value={formatDate(data.startDate)} />
          <Stat icon={CalendarX2} label="Fin" value={formatDate(data.endDate)} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-text-muted">Pagado</span>
            <span className="font-medium text-text">
              {formatCurrency(data.paidTotal)} de {formatCurrency(data.price)}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-raised"
            role="progressbar"
            aria-valuenow={paidPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                'h-full rounded-full transition-all',
                paidPct >= 100 ? 'bg-success' : 'bg-primary',
              )}
              style={{ width: `${paidPct}%` }}
            />
          </div>
          {data.status === 'PENDING_PAYMENT' && (
            <p className="mt-2 text-xs text-text-muted">
              El restaurante registrará tu pago para activar la pensión.
            </p>
          )}
        </div>

        {data.payments.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-text">Pagos</p>
            <ul className="divide-y divide-border rounded-md border border-border">
              {data.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="text-text">
                    {formatCurrency(payment.amount)}
                    <span className="ml-2 text-xs text-text-muted">
                      {PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {payment.paidAt && (
                      <span className="text-xs text-text-muted">
                        {formatDate(payment.paidAt)}
                      </span>
                    )}
                    <StatusBadge meta={PAYMENT_STATUS[payment.status]} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canCancel && (
          <div className="flex justify-end border-t border-border pt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              Cancelar pensión
            </Button>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Cancelar esta pensión?"
        description="Se anularán los pagos registrados y no podrás reactivarla. Esta acción no se puede deshacer."
        confirmLabel="Sí, cancelar"
        danger
        loading={cancel.isPending}
        onConfirm={handleCancel}
      />
    </Card>
  );
}
