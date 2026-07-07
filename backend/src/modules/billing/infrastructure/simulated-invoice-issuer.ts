import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  InvoiceIssuer,
  IssueInvoiceInput,
  IssuedInvoice,
} from '../../pensions/application/ports/invoice-issuer.port';

/** Default series code assigned lazily on a restaurant's first invoice. */
export const DEFAULT_SERIES_CODE = 'F001';

/**
 * Simulated implementation of the InvoiceIssuer port. No external emitter and
 * no file storage: the correctness that matters (gapless, duplicate-free
 * correlative numbering) lives entirely in the two SQL statements below, run
 * inside the caller's transaction. Swapping this for a real emitter (SUNAT…)
 * touches only this adapter — the Pensions domain never changes.
 */
@Injectable()
export class SimulatedInvoiceIssuer implements InvoiceIssuer {
  async issueForPayment(
    tx: Prisma.TransactionClient,
    input: IssueInvoiceInput,
  ): Promise<IssuedInvoice> {
    // Atomic get-or-create + increment in one statement. On first invoice the
    // row is inserted with next_number = 2 and the assigned number is 1; on
    // every later invoice ON CONFLICT bumps next_number and returns the value
    // it just consumed. The row lock ON CONFLICT DO UPDATE takes serialises
    // concurrent activations of the SAME restaurant — no gaps, no duplicates.
    const [series] = await tx.$queryRaw<
      { id: string; series: string; assigned: number }[]
    >`
      INSERT INTO invoice_series (id, restaurant_id, series, next_number)
      VALUES (gen_random_uuid(), ${input.restaurantId}::uuid, ${DEFAULT_SERIES_CODE}, 2)
      ON CONFLICT (restaurant_id, series)
      DO UPDATE SET next_number = invoice_series.next_number + 1
      RETURNING id, series, next_number - 1 AS assigned
    `;

    // Invoice.paymentId @unique + @@unique([seriesId, number]) are the DB
    // safety nets. Activation happens once under the pension lock, so this
    // insert runs once per payment; a stray retry would be rejected here.
    const [invoice] = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO invoices (id, payment_id, series_id, number, issued_at, total, status, created_at)
      VALUES (
        gen_random_uuid(),
        ${input.paymentId}::uuid,
        ${series.id}::uuid,
        ${series.assigned},
        now(),
        ${input.total}::numeric(10, 2),
        'ISSUED',
        now()
      )
      RETURNING id
    `;

    return { id: invoice.id, series: series.series, number: series.assigned };
  }

  async voidForPension(
    tx: Prisma.TransactionClient,
    pensionId: string,
  ): Promise<number> {
    // Void invoices whose payment belongs to this pension. Numbers are left
    // as-is: a VOIDED invoice keeps its slot so "no gaps, no duplicates"
    // stays honest. Under the current void rules only PENDING pensions void
    // payments (and those have no invoice yet), so this is defensive — correct
    // the day the emission trigger or void policy changes.
    const affected = await tx.$executeRaw`
      UPDATE invoices
      SET status = 'VOIDED'
      WHERE status = 'ISSUED'
        AND payment_id IN (
          SELECT id FROM payments WHERE pension_id = ${pensionId}::uuid
        )
    `;
    return affected;
  }
}
