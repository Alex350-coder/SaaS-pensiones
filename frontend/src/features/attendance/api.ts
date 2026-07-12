import { apiFetch, type Paginated } from '@/lib/api-client';
import type { AttendanceView } from '@/lib/api-types';

export type ConfirmableStatus = 'WILL_ATTEND' | 'WILL_NOT_ATTEND';

export interface ConfirmAttendanceInput {
  pensionId: string;
  date: string;
  status: ConfirmableStatus;
}

/** Idempotent upsert on (pension, date): re-answering replaces the answer. */
export function confirmAttendance(
  input: ConfirmAttendanceInput,
): Promise<AttendanceView> {
  return apiFetch<AttendanceView>('/attendance', { method: 'PUT', body: input });
}

export function listMyAttendance({
  pensionId,
  page = 1,
  limit = 60,
}: { pensionId?: string; page?: number; limit?: number } = {}): Promise<
  Paginated<AttendanceView>
> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (pensionId) query.set('pensionId', pensionId);
  return apiFetch<Paginated<AttendanceView>>(`/attendance/mine?${query.toString()}`);
}
