/**
 * Reservations domain rules. Pure: no Nest, no Prisma (lean hexagonal,
 * docs/arquitectura.md §2). Dates are UTC-midnight calendar days.
 *
 * Cutoff decision (roadmap F7 leaves it open): a menu is reservable for its
 * own day or a future day; a reservation can be modified or cancelled while
 * it is CONFIRMED and its menu day has not passed. There is no time-of-day
 * cutoff because service hours are not modeled per menu.
 */
export type ReservationRuleViolation =
  | 'RESERVATION_DATE_PAST'
  | 'NO_ACTIVE_PENSION'
  | 'RESERVATION_NOT_MODIFIABLE';

export interface CoveringPensionCandidate {
  status: string;
  /** Coverage is startDate inclusive → endDate exclusive (pension-dates). */
  startDate: Date;
  endDate: Date;
}

export function reservationCreateViolation(input: {
  menuDate: Date;
  today: Date;
  pension: CoveringPensionCandidate | null;
}): ReservationRuleViolation | null {
  if (input.menuDate.getTime() < input.today.getTime()) {
    return 'RESERVATION_DATE_PAST';
  }
  if (!input.pension || !coversDate(input.pension, input.menuDate)) {
    return 'NO_ACTIVE_PENSION';
  }
  return null;
}

export function reservationChangeViolation(input: {
  status: string;
  menuDate: Date;
  today: Date;
}): ReservationRuleViolation | null {
  if (
    input.status !== 'CONFIRMED' ||
    input.menuDate.getTime() < input.today.getTime()
  ) {
    return 'RESERVATION_NOT_MODIFIABLE';
  }
  return null;
}

export function coversDate(
  pension: CoveringPensionCandidate,
  date: Date,
): boolean {
  return (
    pension.status === 'ACTIVE' &&
    pension.startDate.getTime() <= date.getTime() &&
    date.getTime() < pension.endDate.getTime()
  );
}
