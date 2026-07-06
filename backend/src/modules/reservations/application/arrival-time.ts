/**
 * Prisma maps time(0) columns to Date objects anchored on 1970-01-01 UTC.
 * These helpers keep the HH:MM wire format at the edges; validation of the
 * string shape happens in the DTO (ARRIVAL_TIME_PATTERN).
 */
export function arrivalTimeToDb(value: string): Date {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

export function arrivalTimeFromDb(value: Date): string {
  return value.toISOString().slice(11, 16);
}
