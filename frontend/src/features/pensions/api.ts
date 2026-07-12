import { apiFetch, type Paginated } from '@/lib/api-client';
import type {
  PensionDetailView,
  PensionStatus,
  PensionView,
} from '@/lib/api-types';

export function contractPension(restaurantId: string): Promise<PensionView> {
  return apiFetch<PensionView>('/pensions', {
    method: 'POST',
    body: { restaurantId },
  });
}

export function listMyPensions({
  page = 1,
  limit = 20,
  status,
}: { page?: number; limit?: number; status?: PensionStatus } = {}): Promise<
  Paginated<PensionView>
> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) query.set('status', status);
  return apiFetch<Paginated<PensionView>>(`/pensions/mine?${query.toString()}`);
}

export function getMyPension(id: string): Promise<PensionDetailView> {
  return apiFetch<PensionDetailView>(`/pensions/mine/${encodeURIComponent(id)}`);
}

export function cancelPension(id: string): Promise<PensionView> {
  return apiFetch<PensionView>(
    `/pensions/mine/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  );
}
