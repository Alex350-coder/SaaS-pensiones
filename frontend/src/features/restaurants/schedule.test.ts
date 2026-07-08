import { describe, expect, it } from 'vitest';
import type { ScheduleView } from '@/lib/api-types';
import { getOpenState } from './schedule';

const scheduleFor = (dow: number, opensAt: string, closesAt: string): ScheduleView => ({
  dayOfWeek: dow,
  opensAt,
  closesAt,
});

describe('getOpenState', () => {
  it('reports open when the current time is within today hours', () => {
    const now = new Date(2026, 6, 7, 12, 0); // noon
    const schedules = [scheduleFor(now.getDay(), '11:30', '16:00')];
    const state = getOpenState(schedules, now);
    expect(state.isOpen).toBe(true);
    expect(state.today).toBeDefined();
  });

  it('reports closed when outside today hours', () => {
    const now = new Date(2026, 6, 7, 12, 0);
    const schedules = [scheduleFor(now.getDay(), '17:00', '22:00')];
    expect(getOpenState(schedules, now).isOpen).toBe(false);
  });

  it('reports closed with no schedule for today', () => {
    const now = new Date(2026, 6, 7, 12, 0);
    const otherDay = (now.getDay() + 1) % 7;
    const state = getOpenState([scheduleFor(otherDay, '11:30', '16:00')], now);
    expect(state.isOpen).toBe(false);
    expect(state.today).toBeUndefined();
  });

  it('treats the closing minute as already closed', () => {
    const now = new Date(2026, 6, 7, 16, 0);
    const schedules = [scheduleFor(now.getDay(), '11:30', '16:00')];
    expect(getOpenState(schedules, now).isOpen).toBe(false);
  });
});
