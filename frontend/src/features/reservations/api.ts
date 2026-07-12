import { apiFetch, type Paginated } from '@/lib/api-client';
import type { ClientReservationView, ReservationStatus } from '@/lib/api-types';

export interface CreateReservationInput {
  dailyMenuId: string;
  estimatedArrival: string;
  notes?: string;
}

export interface UpdateReservationInput {
  estimatedArrival?: string;
  notes?: string | null;
}

export function createReservation(
  input: CreateReservationInput,
): Promise<ClientReservationView> {
  return apiFetch<ClientReservationView>('/reservations', {
    method: 'POST',
    body: input,
  });
}

export function listMyReservations({
  page = 1,
  limit = 20,
  status,
}: { page?: number; limit?: number; status?: ReservationStatus } = {}): Promise<
  Paginated<ClientReservationView>
> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) query.set('status', status);
  return apiFetch<Paginated<ClientReservationView>>(
    `/reservations/mine?${query.toString()}`,
  );
}

export function updateReservation(
  id: string,
  input: UpdateReservationInput,
): Promise<ClientReservationView> {
  return apiFetch<ClientReservationView>(
    `/reservations/mine/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: input },
  );
}

export function cancelReservation(id: string): Promise<ClientReservationView> {
  return apiFetch<ClientReservationView>(
    `/reservations/mine/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  );
}
