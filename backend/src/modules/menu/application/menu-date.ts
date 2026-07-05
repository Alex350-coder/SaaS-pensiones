import { BadRequestException } from '@nestjs/common';

export const MENU_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Menu dates are calendar days (DB column is DATE, no time zone). The whole
 * system anchors them at UTC midnight — same rule the pension/attendance
 * invariants use (docs/roadmap.md F6: consistency in UTC).
 */
export function parseMenuDate(value: string): Date {
  if (MENU_DATE_PATTERN.test(value)) {
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

export function formatMenuDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today as a UTC calendar day (the public "menú del día" default). */
export function todayMenuDate(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}
