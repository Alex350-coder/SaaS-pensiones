import type { ScheduleView } from '@/lib/api-types';

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** The schedule row for a given weekday (0=Sun..6=Sat), if the restaurant opens. */
export function scheduleForDay(
  schedules: ScheduleView[],
  dayOfWeek: number,
): ScheduleView | undefined {
  return schedules.find((s) => s.dayOfWeek === dayOfWeek);
}

export interface OpenState {
  isOpen: boolean;
  /** Today's hours if the restaurant opens today. */
  today: ScheduleView | undefined;
}

/**
 * Whether the restaurant is open at the current local wall-clock time. Hours
 * are stored as plain 'HH:MM' strings, compared against the browser's local
 * time — good enough for an at-a-glance "abierto/cerrado" indicator.
 */
export function getOpenState(schedules: ScheduleView[], now = new Date()): OpenState {
  const today = scheduleForDay(schedules, now.getDay());
  if (!today) return { isOpen: false, today: undefined };

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const isOpen =
    minutesNow >= toMinutes(today.opensAt) && minutesNow < toMinutes(today.closesAt);
  return { isOpen, today };
}
