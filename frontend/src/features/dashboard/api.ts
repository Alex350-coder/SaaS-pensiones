import { apiFetch } from '@/lib/api-client';
import type { DashboardMetrics } from '@/lib/api-types';

export function getDashboard(): Promise<DashboardMetrics> {
  return apiFetch<DashboardMetrics>('/restaurants/mine/dashboard');
}
