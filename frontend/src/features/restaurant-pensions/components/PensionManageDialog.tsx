import { useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorState } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import type { PaymentMethod } from '@/lib/api-types';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS,
  PENSION_STATUS,
} from '@/lib/status';
import { useChangePensionStatus, useRegisterPayment, useRestaurantPension } from '../hooks';

const METHODS: PaymentMethod[] = ['CASH', 'TRANSFER', 'CARD'];

export function PensionManageDialog({
  pensionId,
  onClose,
}: {
  pensionId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch } = useRestaurantPension(pensionId);
  const registerPayment = useRegisterPayment();
  const changeStatus = useChangePensionStatus();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');

  const outstanding = data ? Math.max(0, data.price - data.paidTotal) : 0;

  const handlePay = () => {
    const value = Number(amount);
    if (!pensionId || !Number.isFinite(value) || value <= 0) {
      toast.error('Ingresa un monto válido.');
      return;
    }
    registerPayment.mutate(
      { id: pensionId, input: { amount: value, method } },
      {
        onSuccess: (result) => {
          toast.success(
            result.activated
              ? '¡Pago registrado y pensión activada!'
              : 'Pago registrado.',
          );
          setAmount('');
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : 'No se pudo registrar el pago.',
          ),
      },
    );
  };

  const handleStatus = (status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') => {
    if (!pensionId) return;
    changeStatus.mutate(
      { id: pensionId, status },
      {
        onSuccess: () => toast.success('Estado actualizado.'),
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : 'No se pudo actualizar.',
          ),
      },
    );
  };

  return (
    <Dialog open={pensionId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {isLoading && <Skeleton className="h-72 w-full" />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between gap-3">
                <DialogTitle>{data.client.fullName}</DialogTitle>
                <StatusBadge meta={PENSION_STATUS[data.status]} />
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-text-muted">Período</p>
                  <p className="font-medium text-text">
                    {formatDate(data.startDate)} – {formatDate(data.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted">Pagado</p>
                  <p className="font-medium text-text">
                    {formatCurrency(data.paidTotal)} / {formatCurrency(data.price)}
                  </p>
                </div>
              </div>

              {data.payments.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border text-sm">
                  {data.payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <span>
                        {formatCurrency(payment.amount)}
                        <span className="ml-2 text-xs text-text-muted">
                          {PAYMENT_METHOD_LABEL[payment.method]}
                        </span>
                      </span>
                      <StatusBadge meta={PAYMENT_STATUS[payment.status]} />
                    </li>
                  ))}
                </ul>
              )}

              {data.status === 'PENDING_PAYMENT' && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-text">
                    Registrar pago{' '}
                    <span className="text-text-muted">
                      (saldo {formatCurrency(outstanding)})
                    </span>
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-amount">Monto</Label>
                      <Input
                        id="pay-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-32"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-method">Método</Label>
                      <select
                        id="pay-method"
                        value={method}
                        onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                        className="flex h-11 rounded-md border border-border bg-surface px-3 text-sm text-text focus-visible:border-primary focus-visible:shadow-focus-ring focus-visible:outline-none"
                      >
                        {METHODS.map((m) => (
                          <option key={m} value={m}>
                            {PAYMENT_METHOD_LABEL[m]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button loading={registerPayment.isPending} onClick={handlePay}>
                      Registrar
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                {data.status === 'ACTIVE' && (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={changeStatus.isPending}
                    onClick={() => handleStatus('SUSPENDED')}
                  >
                    Suspender
                  </Button>
                )}
                {data.status === 'SUSPENDED' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={changeStatus.isPending}
                    onClick={() => handleStatus('ACTIVE')}
                  >
                    Reactivar
                  </Button>
                )}
                {(data.status === 'PENDING_PAYMENT' ||
                  data.status === 'ACTIVE' ||
                  data.status === 'SUSPENDED') && (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={changeStatus.isPending}
                    onClick={() => handleStatus('CANCELLED')}
                  >
                    Cancelar pensión
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
