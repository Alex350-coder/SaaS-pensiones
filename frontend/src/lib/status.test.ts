import { describe, expect, it } from 'vitest';
import {
  ATTENDANCE_STATUS,
  INVOICE_STATUS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS,
  PENSION_STATUS,
  RESERVATION_STATUS,
  RESTAURANT_STATUS,
  USER_STATUS,
} from './status';

describe('status metadata maps', () => {
  it('label pension statuses in Spanish with a semantic variant', () => {
    expect(PENSION_STATUS.ACTIVE).toEqual({ label: 'Activa', variant: 'success' });
    expect(PENSION_STATUS.PENDING_PAYMENT.variant).toBe('warning');
    expect(PENSION_STATUS.CANCELLED.variant).toBe('danger');
  });

  it('cover every enum member of each map', () => {
    expect(Object.keys(PENSION_STATUS)).toHaveLength(5);
    expect(Object.keys(PAYMENT_STATUS)).toHaveLength(3);
    expect(Object.keys(RESERVATION_STATUS)).toHaveLength(4);
    expect(Object.keys(ATTENDANCE_STATUS)).toHaveLength(4);
    expect(Object.keys(INVOICE_STATUS)).toHaveLength(2);
    expect(Object.keys(RESTAURANT_STATUS)).toHaveLength(3);
    expect(Object.keys(USER_STATUS)).toHaveLength(2);
  });

  it('every entry carries a non-empty label and a known variant', () => {
    const variants = new Set([
      'neutral',
      'primary',
      'success',
      'warning',
      'danger',
      'secondary',
    ]);
    for (const map of [
      PENSION_STATUS,
      PAYMENT_STATUS,
      RESERVATION_STATUS,
      ATTENDANCE_STATUS,
      INVOICE_STATUS,
      RESTAURANT_STATUS,
      USER_STATUS,
    ]) {
      for (const meta of Object.values(map)) {
        expect(meta.label.length).toBeGreaterThan(0);
        expect(variants.has(meta.variant)).toBe(true);
      }
    }
  });

  it('labels payment methods', () => {
    expect(PAYMENT_METHOD_LABEL.CASH).toBe('Efectivo');
    expect(PAYMENT_METHOD_LABEL.TRANSFER).toBe('Transferencia');
    expect(PAYMENT_METHOD_LABEL.CARD).toBe('Tarjeta');
  });
});
