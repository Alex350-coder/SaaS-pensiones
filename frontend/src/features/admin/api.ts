import { apiFetch, type Paginated } from '@/lib/api-client';
import type {
  AdminRestaurantView,
  AdminUserView,
  AuditEventView,
  RestaurantStatus,
  UserRole,
  UserStatus,
} from '@/lib/api-types';

// --- Restaurants ------------------------------------------------------------

export function listAdminRestaurants({
  page = 1,
  limit = 30,
  status,
}: { page?: number; limit?: number; status?: RestaurantStatus } = {}): Promise<
  Paginated<AdminRestaurantView>
> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) query.set('status', status);
  return apiFetch<Paginated<AdminRestaurantView>>(
    `/admin/restaurants?${query.toString()}`,
  );
}

export function changeRestaurantStatus(
  id: string,
  status: 'APPROVED' | 'SUSPENDED',
): Promise<AdminRestaurantView> {
  return apiFetch<AdminRestaurantView>(
    `/admin/restaurants/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: { status } },
  );
}

// --- Users ------------------------------------------------------------------

export function listAdminUsers({
  page = 1,
  limit = 30,
  role,
  status,
}: {
  page?: number;
  limit?: number;
  role?: UserRole;
  status?: UserStatus;
} = {}): Promise<Paginated<AdminUserView>> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (role) query.set('role', role);
  if (status) query.set('status', status);
  return apiFetch<Paginated<AdminUserView>>(`/admin/users?${query.toString()}`);
}

export function changeUserStatus(
  id: string,
  status: UserStatus,
): Promise<AdminUserView> {
  return apiFetch<AdminUserView>(
    `/admin/users/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: { status } },
  );
}

// --- Audit ------------------------------------------------------------------

export function listAuditEvents({
  page = 1,
  limit = 40,
}: { page?: number; limit?: number } = {}): Promise<Paginated<AuditEventView>> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<Paginated<AuditEventView>>(
    `/auth/audit-events?${query.toString()}`,
  );
}
