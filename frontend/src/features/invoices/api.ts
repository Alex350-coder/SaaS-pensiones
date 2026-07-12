import { apiFetch, type Paginated } from '@/lib/api-client';
import type { InvoiceView } from '@/lib/api-types';

/** Client's own invoices (emitted for their payments). */
export function listClientInvoices({
  page = 1,
  limit = 20,
}: { page?: number; limit?: number } = {}): Promise<Paginated<InvoiceView>> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<Paginated<InvoiceView>>(`/invoices?${query.toString()}`);
}

/** Restaurant owner's issued invoices. */
export function listRestaurantInvoices({
  page = 1,
  limit = 20,
}: { page?: number; limit?: number } = {}): Promise<Paginated<InvoiceView>> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<Paginated<InvoiceView>>(
    `/restaurants/mine/invoices?${query.toString()}`,
  );
}

/** PDF stream paths (downloaded via usePdfDownload with the bearer token). */
export const clientInvoicePdfPath = (id: string): string =>
  `/invoices/${encodeURIComponent(id)}/pdf`;

export const restaurantInvoicePdfPath = (id: string): string =>
  `/restaurants/mine/invoices/${encodeURIComponent(id)}/pdf`;
