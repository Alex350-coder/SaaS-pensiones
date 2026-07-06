import { activationPeriod, daysRemaining, isExpired } from './pension-dates';
import {
  assertTransition,
  canTransition,
  PensionActor,
} from './pension-status.machine';
import { PensionStatus } from './pension';
import { InvalidPensionTransitionError } from './pension.errors';

const D = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

describe('activationPeriod', () => {
  it('spans exactly 30 days (DB CHECK chk_pension_30_days)', () => {
    const { startDate, endDate } = activationPeriod(D('2026-07-05'));

    expect(startDate.toISOString()).toBe('2026-07-05T00:00:00.000Z');
    expect(endDate.toISOString()).toBe('2026-08-04T00:00:00.000Z');
  });
});

describe('daysRemaining (UTC-consistent — exit criterion F6)', () => {
  const active = { status: 'ACTIVE' as PensionStatus, endDate: D('2026-08-04') };

  it('reports the full period for PENDING_PAYMENT (tentative dates)', () => {
    expect(
      daysRemaining(
        { status: 'PENDING_PAYMENT', endDate: D('2026-08-04') },
        D('2026-07-20'),
      ),
    ).toBe(30);
  });

  it('counts down for ACTIVE pensions', () => {
    expect(daysRemaining(active, D('2026-07-05'))).toBe(30);
    expect(daysRemaining(active, D('2026-07-20'))).toBe(15);
    expect(daysRemaining(active, D('2026-08-03'))).toBe(1);
  });

  it('clamps at 0 on and after the end date', () => {
    expect(daysRemaining(active, D('2026-08-04'))).toBe(0);
    expect(daysRemaining(active, D('2026-09-01'))).toBe(0);
  });

  it('keeps counting down while SUSPENDED (no period extension)', () => {
    expect(
      daysRemaining(
        { status: 'SUSPENDED', endDate: D('2026-08-04') },
        D('2026-07-30'),
      ),
    ).toBe(5);
  });

  it('reports 0 for terminal states', () => {
    for (const status of ['EXPIRED', 'CANCELLED'] as PensionStatus[]) {
      expect(daysRemaining({ status, endDate: D('2026-08-04') }, D('2026-07-05'))).toBe(0);
    }
  });
});

describe('isExpired', () => {
  it('expires exactly at endDate (exclusive coverage)', () => {
    expect(isExpired(D('2026-08-04'), D('2026-08-03'))).toBe(false);
    expect(isExpired(D('2026-08-04'), D('2026-08-04'))).toBe(true);
    expect(isExpired(D('2026-08-04'), D('2026-08-05'))).toBe(true);
  });
});

describe('pension status machine', () => {
  const allowed: Array<[PensionActor, PensionStatus, PensionStatus]> = [
    ['CLIENT', 'PENDING_PAYMENT', 'CANCELLED'],
    ['RESTAURANT_ADMIN', 'PENDING_PAYMENT', 'CANCELLED'],
    ['RESTAURANT_ADMIN', 'ACTIVE', 'SUSPENDED'],
    ['RESTAURANT_ADMIN', 'ACTIVE', 'CANCELLED'],
    ['RESTAURANT_ADMIN', 'SUSPENDED', 'ACTIVE'],
    ['RESTAURANT_ADMIN', 'SUSPENDED', 'CANCELLED'],
    ['SYSTEM', 'PENDING_PAYMENT', 'ACTIVE'],
    ['SYSTEM', 'ACTIVE', 'EXPIRED'],
  ];

  const denied: Array<[PensionActor, PensionStatus, PensionStatus]> = [
    ['CLIENT', 'ACTIVE', 'CANCELLED'],
    ['CLIENT', 'ACTIVE', 'SUSPENDED'],
    ['CLIENT', 'PENDING_PAYMENT', 'ACTIVE'],
    ['RESTAURANT_ADMIN', 'PENDING_PAYMENT', 'ACTIVE'],
    ['RESTAURANT_ADMIN', 'EXPIRED', 'ACTIVE'],
    ['RESTAURANT_ADMIN', 'CANCELLED', 'ACTIVE'],
    ['SYSTEM', 'SUSPENDED', 'EXPIRED'],
  ];

  it.each(allowed)('%s: %s -> %s allowed', (actor, from, to) => {
    expect(canTransition(actor, from, to)).toBe(true);
    expect(() => assertTransition(actor, from, to)).not.toThrow();
  });

  it.each(denied)('%s: %s -> %s denied', (actor, from, to) => {
    expect(canTransition(actor, from, to)).toBe(false);
    expect(() => assertTransition(actor, from, to)).toThrow(
      InvalidPensionTransitionError,
    );
  });
});
