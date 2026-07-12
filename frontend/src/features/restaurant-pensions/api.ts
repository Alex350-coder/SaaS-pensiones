import { apiFetch, type Paginated } from '@/lib/api-client';
import type {
  PaymentMethod,
  PaymentView,
  PensionDetailView,
  PensionStatus,
  PensionView,
} from '@/lib/api-types';

export interface RegisterPaymentInput {
  amount: number;
  method: PaymentMethod;
  paidAt?: string;
}

export interface RegisterPaymentResult {
  pension: PensionView;
  payment: PaymentView;
  paidTotal: number;
  activated: boolean;
}

export function listRestaurantPensions({
  page = 1,
  limit = 30,
  status,
}: { page?: number; limit?: number; status?: PensionStatus } = {}): Promise<
  Paginated<PensionView>
> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) query.set('status', status);
  return apiFetch<Paginated<PensionView>>(
    `/restaurants/mine/pensions?${query.toString()}`,
  );
}

export function listExpiringPensions(days = 3): Promise<Paginated<PensionView>> {
  return apiFetch<Paginated<PensionView>>(
    `/restaurants/mine/pensions/expiring?days=${days}`,
  );
}

export function getRestaurantPension(id: string): Promise<PensionDetailView> {
  return apiFetch<PensionDetailView>(
    `/restaurants/mine/pensions/${encodeURIComponent(id)}`,
  );
}

export function registerPayment(
  id: string,
  input: RegisterPaymentInput,
): Promise<RegisterPaymentResult> {
  return apiFetch<RegisterPaymentResult>(
    `/restaurants/mine/pensions/${encodeURIComponent(id)}/payments`,
    { method: 'POST', body: input },
  );
}

export function changePensionStatus(
  id: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED',
): Promise<PensionView> {
  return apiFetch<PensionView>(
    `/restaurants/mine/pensions/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: { status } },
  );
}
