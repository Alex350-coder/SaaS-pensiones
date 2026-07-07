import { Invoice, InvoiceStatus } from '@prisma/client';

/** Padding for the human-facing correlative, e.g. number 1 → "F001-000001". */
const NUMBER_PAD = 6;

export interface InvoiceView {
  id: string;
  series: string;
  number: number;
  /** Display code combining series + zero-padded number (e.g. "F001-000001"). */
  serial: string;
  status: InvoiceStatus;
  total: number;
  issuedAt: Date;
  pensionId: string;
  restaurant: { id: string; name: string; slug: string };
  client: { id: string; fullName: string; email: string };
}

/** Shape returned by the Prisma query that hydrates an invoice with its parties. */
export type InvoiceRow = Invoice & {
  series: { series: string };
  payment: {
    pension: {
      id: string;
      restaurant: { id: string; name: string; slug: string };
      client: { id: string; fullName: string; email: string };
    };
  };
};

export function formatSerial(series: string, number: number): string {
  return `${series}-${String(number).padStart(NUMBER_PAD, '0')}`;
}

export function toInvoiceView(row: InvoiceRow): InvoiceView {
  return {
    id: row.id,
    series: row.series.series,
    number: row.number,
    serial: formatSerial(row.series.series, row.number),
    status: row.status,
    total: Number(row.total),
    issuedAt: row.issuedAt,
    pensionId: row.payment.pension.id,
    restaurant: row.payment.pension.restaurant,
    client: row.payment.pension.client,
  };
}
