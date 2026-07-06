import { CoveringPensionCandidate, coversDate } from './reservation-rules';

/**
 * Attendance confirmation rules (docs/database-design.md §4, app-enforced
 * invariants #1 and #4). Pure: no Nest, no Prisma.
 *
 * A pensioner answers "asistiré / no asistiré" for a calendar day. The answer
 * is an upsert (UNIQUE pension+date in DB) and is only accepted when:
 *  - the pension is ACTIVE (invariant #4),
 *  - the day falls inside the pension's coverage (invariant #1), and
 *  - the day has not passed (answers about the past are meaningless —
 *    ATTENDED/NO_SHOW reconciliation is a later restaurant-side feature).
 */
export type AttendanceRuleViolation =
  | 'PENSION_NOT_ACTIVE'
  | 'ATTENDANCE_OUT_OF_PERIOD'
  | 'ATTENDANCE_DATE_PAST';

export function attendanceViolation(input: {
  pension: CoveringPensionCandidate;
  date: Date;
  today: Date;
}): AttendanceRuleViolation | null {
  if (input.pension.status !== 'ACTIVE') {
    return 'PENSION_NOT_ACTIVE';
  }
  if (input.date.getTime() < input.today.getTime()) {
    return 'ATTENDANCE_DATE_PAST';
  }
  if (!coversDate(input.pension, input.date)) {
    return 'ATTENDANCE_OUT_OF_PERIOD';
  }
  return null;
}
