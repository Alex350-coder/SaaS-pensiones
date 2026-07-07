import { Prisma } from '@prisma/client';

export const INVOICE_ISSUER = Symbol('INVOICE_ISSUER');

/** What the caller knows when a pension activates and a payment must be billed. */
export interface IssueInvoiceInput {
  /** The activating payment. Invoice.paymentId @unique makes emission idempotent. */
  paymentId: string;
  restaurantId: string;
  /** The full contracted amount (the pension price), not the partial payment. */
  total: number;
}

/** The issued invoice's identifying coordinates, for auditing and the response. */
export interface IssuedInvoice {
  id: string;
  series: string;
  number: number;
}

/**
 * Outbound port owned by the Pensions context: the payment flow needs "issue
 * an invoice" without knowing how (simulated PDF now, real emitter later).
 * Billing implements it; the dependency arrow stays Billing → Pensions.
 *
 * Both methods run INSIDE the caller's transaction (the pension row lock).
 * That is what makes correlative numbering atomic — the number is assigned
 * under the same lock that gates activation, never via a racy count().
 */
export interface InvoiceIssuer {
  /**
   * Issues one invoice for an activated pension's payment. Assigns the next
   * correlative number atomically and lazily provisions the restaurant's
   * series on first use. Invoice.paymentId @unique is the DB safety net.
   */
  issueForPayment(
    tx: Prisma.TransactionClient,
    input: IssueInvoiceInput,
  ): Promise<IssuedInvoice>;

  /**
   * Voids every ISSUED invoice tied to the given pension's payments (refund
   * trail). Numbers are never reused or renumbered — gaps are kept honest.
   * Returns the count voided.
   */
  voidForPension(
    tx: Prisma.TransactionClient,
    pensionId: string,
  ): Promise<number>;
}
