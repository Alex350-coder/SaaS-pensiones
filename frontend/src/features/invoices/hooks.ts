import { useQuery } from '@tanstack/react-query';
import * as api from './api';

export const invoiceKeys = {
  all: ['invoices'] as const,
  client: () => [...invoiceKeys.all, 'client'] as const,
  restaurant: () => [...invoiceKeys.all, 'restaurant'] as const,
};

export function useClientInvoices() {
  return useQuery({
    queryKey: invoiceKeys.client(),
    queryFn: () => api.listClientInvoices({ limit: 30 }),
  });
}

export function useRestaurantInvoices() {
  return useQuery({
    queryKey: invoiceKeys.restaurant(),
    queryFn: () => api.listRestaurantInvoices({ limit: 30 }),
  });
}
