import { BadRequestException } from '@nestjs/common';

export const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calendar days across the system (DB DATE columns) are anchored at UTC
 * midnight, so date math never depends on the server's local time zone
 * (docs/roadmap.md F6: expiration consistent under server date changes).
 */
export function parseUtcDate(value: string): Date {
  if (UTC_DATE_PATTERN.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    // Round-trip guard: rejects 2026-02-31, 2026-13-01 and friends.
    if (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    ) {
      return date;
    }
  }
  throw new BadRequestException({
    code: 'INVALID_DATE',
    message: 'La fecha debe tener formato YYYY-MM-DD y ser válida.',
  });
}

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole days from `from` to `to` (negative when `to` is in the past). */
export function diffUtcDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}
