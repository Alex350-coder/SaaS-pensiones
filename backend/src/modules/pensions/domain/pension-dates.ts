import { PENSION_DAYS, PensionStatus } from './pension';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A pension covers startDate (inclusive) to endDate (exclusive): exactly 30
 * meal days. The DB CHECK chk_pension_30_days enforces end = start + 30.
 * All dates are UTC-midnight calendar days — never server-local time.
 */
export function activationPeriod(activationDay: Date): {
  startDate: Date;
  endDate: Date;
} {
  return {
    startDate: activationDay,
    endDate: new Date(activationDay.getTime() + PENSION_DAYS * MS_PER_DAY),
  };
}

export function isExpired(endDate: Date, todayUtc: Date): boolean {
  return todayUtc.getTime() >= endDate.getTime();
}

/**
 * Days of coverage left as of `todayUtc`. PENDING_PAYMENT reports the full
 * period (dates are tentative until activation); terminal states report 0.
 * SUSPENDED keeps counting down — suspension does not extend the period.
 */
export function daysRemaining(
  pension: { status: PensionStatus; endDate: Date },
  todayUtc: Date,
): number {
  if (pension.status === 'PENDING_PAYMENT') {
    return PENSION_DAYS;
  }
  if (pension.status !== 'ACTIVE' && pension.status !== 'SUSPENDED') {
    return 0;
  }
  const remaining = Math.round(
    (pension.endDate.getTime() - todayUtc.getTime()) / MS_PER_DAY,
  );
  return Math.max(0, Math.min(PENSION_DAYS, remaining));
}
