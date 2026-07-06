import { attendanceViolation } from './attendance-rules';
import { buildProjection } from './production-projection';
import {
  coversDate,
  reservationChangeViolation,
  reservationCreateViolation,
} from './reservation-rules';

const utc = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const activePension = (
  start: string,
  end: string,
): { status: string; startDate: Date; endDate: Date } => ({
  status: 'ACTIVE',
  startDate: utc(start),
  endDate: utc(end),
});

describe('reservation rules', () => {
  const today = utc('2026-07-06');
  const pension = activePension('2026-07-01', '2026-07-31');

  it('allows reserving today and future menus within coverage', () => {
    // Arrange / Act / Assert
    expect(
      reservationCreateViolation({ menuDate: today, today, pension }),
    ).toBeNull();
    expect(
      reservationCreateViolation({
        menuDate: utc('2026-07-30'),
        today,
        pension,
      }),
    ).toBeNull();
  });

  it('rejects reserving a past menu', () => {
    expect(
      reservationCreateViolation({
        menuDate: utc('2026-07-05'),
        today,
        pension,
      }),
    ).toBe('RESERVATION_DATE_PAST');
  });

  it('rejects reserving without a pension covering the menu date', () => {
    expect(
      reservationCreateViolation({ menuDate: today, today, pension: null }),
    ).toBe('NO_ACTIVE_PENSION');
    // endDate is exclusive: the 31st is already outside a 01→31 coverage.
    expect(
      reservationCreateViolation({
        menuDate: utc('2026-07-31'),
        today,
        pension,
      }),
    ).toBe('NO_ACTIVE_PENSION');
    expect(
      reservationCreateViolation({
        menuDate: today,
        today,
        pension: { ...pension, status: 'SUSPENDED' },
      }),
    ).toBe('NO_ACTIVE_PENSION');
  });

  it('allows changing a CONFIRMED reservation whose day has not passed', () => {
    expect(
      reservationChangeViolation({ status: 'CONFIRMED', menuDate: today, today }),
    ).toBeNull();
  });

  it('rejects changing cancelled or past reservations', () => {
    expect(
      reservationChangeViolation({ status: 'CANCELLED', menuDate: today, today }),
    ).toBe('RESERVATION_NOT_MODIFIABLE');
    expect(
      reservationChangeViolation({
        status: 'CONFIRMED',
        menuDate: utc('2026-07-05'),
        today,
      }),
    ).toBe('RESERVATION_NOT_MODIFIABLE');
  });

  it('coverage is start-inclusive and end-exclusive', () => {
    expect(coversDate(pension, utc('2026-07-01'))).toBe(true);
    expect(coversDate(pension, utc('2026-07-30'))).toBe(true);
    expect(coversDate(pension, utc('2026-07-31'))).toBe(false);
    expect(coversDate(pension, utc('2026-06-30'))).toBe(false);
  });
});

describe('attendance rules', () => {
  const today = utc('2026-07-06');
  const pension = activePension('2026-07-01', '2026-07-31');

  it('accepts an answer for a covered, non-past day of an ACTIVE pension', () => {
    expect(attendanceViolation({ pension, date: today, today })).toBeNull();
  });

  it('rejects non-ACTIVE pensions (invariant #4)', () => {
    for (const status of ['PENDING_PAYMENT', 'SUSPENDED', 'CANCELLED', 'EXPIRED']) {
      expect(
        attendanceViolation({ pension: { ...pension, status }, date: today, today }),
      ).toBe('PENSION_NOT_ACTIVE');
    }
  });

  it('rejects days outside the coverage period (invariant #1)', () => {
    expect(
      attendanceViolation({ pension, date: utc('2026-07-31'), today }),
    ).toBe('ATTENDANCE_OUT_OF_PERIOD');
  });

  it('rejects past days', () => {
    expect(
      attendanceViolation({ pension, date: utc('2026-07-05'), today }),
    ).toBe('ATTENDANCE_DATE_PAST');
  });
});

describe('production projection', () => {
  it('partitions active pensioners into attend/not-attend/unanswered', () => {
    const projection = buildProjection({
      activePensioners: 10,
      willAttend: 4,
      willNotAttend: 2,
      confirmedReservations: 5,
    });

    expect(projection.pensioners).toEqual({ active: 10, unanswered: 4 });
    expect(projection.attendance).toEqual({ willAttend: 4, willNotAttend: 2 });
    expect(projection.reservations).toEqual({ confirmed: 5 });
    expect(projection.projectedAttendance).toBe(8);
  });

  it('never reports negative unanswered even with inconsistent counts', () => {
    const projection = buildProjection({
      activePensioners: 3,
      willAttend: 3,
      willNotAttend: 1,
      confirmedReservations: 0,
    });

    expect(projection.pensioners.unanswered).toBe(0);
    expect(projection.projectedAttendance).toBe(3);
  });
});
