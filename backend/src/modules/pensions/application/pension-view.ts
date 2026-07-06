import { ConflictException } from '@nestjs/common';
import { formatUtcDate } from '../../../core/dates/utc-date';
import { daysRemaining } from '../domain/pension-dates';
import { PensionDomainError } from '../domain/pension.errors';
import {
  PaymentSnapshot,
  PensionWithParties,
} from './ports/pension.repository';

export interface PensionView {
  id: string;
  status: PensionWithParties['status'];
  startDate: string;
  endDate: string;
  price: number;
  daysRemaining: number;
  client: { id: string; fullName: string; email: string };
  restaurant: { id: string; name: string; slug: string };
  createdAt: Date;
}

export interface PaymentView {
  id: string;
  amount: number;
  method: PaymentSnapshot['method'];
  status: PaymentSnapshot['status'];
  paidAt: Date | null;
}

export function toPensionView(
  pension: PensionWithParties,
  todayUtc: Date,
): PensionView {
  return {
    id: pension.id,
    status: pension.status,
    startDate: formatUtcDate(pension.startDate),
    endDate: formatUtcDate(pension.endDate),
    price: pension.price,
    daysRemaining: daysRemaining(pension, todayUtc),
    client: pension.client,
    restaurant: pension.restaurant,
    createdAt: pension.createdAt,
  };
}

export function toPaymentView(payment: PaymentSnapshot): PaymentView {
  return {
    id: payment.id,
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    paidAt: payment.paidAt,
  };
}

/** Money comparisons happen in integer cents — never float arithmetic. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Translates typed domain errors to the standard HTTP envelope (409). */
export function rethrowDomainError(error: unknown): never {
  if (error instanceof PensionDomainError) {
    throw new ConflictException({ code: error.code, message: error.message });
  }
  throw error;
}
