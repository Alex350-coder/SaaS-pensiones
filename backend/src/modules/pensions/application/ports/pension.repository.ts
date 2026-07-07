import { Prisma } from '@prisma/client';
import { PensionSnapshot, PensionStatus } from '../../domain/pension';

export const PENSION_REPOSITORY = Symbol('PENSION_REPOSITORY');

export interface PaymentSnapshot {
  id: string;
  pensionId: string;
  amount: number;
  method: 'CASH' | 'TRANSFER' | 'CARD';
  status: 'PENDING' | 'CONFIRMED' | 'VOIDED';
  paidAt: Date | null;
  registeredById: string;
}

export interface PensionWithParties extends PensionSnapshot {
  client: { id: string; fullName: string; email: string };
  restaurant: { id: string; name: string; slug: string };
}

export interface PageRequest {
  skip: number;
  take: number;
}

export interface Page<T> {
  total: number;
  items: T[];
}

/** Operations available while holding the row lock on one pension. */
export interface LockedPensionOps {
  /**
   * The transaction handle backing the lock. Exposed so the payment/void
   * flows can invoke the InvoiceIssuer port within the SAME transaction —
   * correlative numbering must be assigned under this lock, not after commit.
   */
  readonly tx: Prisma.TransactionClient;
  getPension(): Promise<PensionSnapshot | null>;
  sumConfirmedPayments(): Promise<number>;
  createConfirmedPayment(input: {
    amount: number;
    method: PaymentSnapshot['method'];
    paidAt: Date;
    registeredById: string;
  }): Promise<PaymentSnapshot>;
  activate(startDate: Date, endDate: Date): Promise<PensionSnapshot>;
  updateStatus(status: PensionStatus): Promise<PensionSnapshot>;
  /** Marks every CONFIRMED payment as VOIDED (refund trail). Returns count. */
  voidConfirmedPayments(): Promise<number>;
}

export interface PensionRepository {
  /**
   * Creates a PENDING_PAYMENT pension. Throws LivePensionExistsError when
   * the partial unique uq_live_pension_per_client_restaurant rejects it —
   * the "no two live pensions" exit criterion lives in the DB, not here.
   */
  create(input: {
    clientId: string;
    restaurantId: string;
    price: number;
    startDate: Date;
    endDate: Date;
  }): Promise<PensionSnapshot>;

  findForClient(id: string, clientId: string): Promise<PensionWithParties | null>;
  findForRestaurant(
    id: string,
    restaurantId: string,
  ): Promise<PensionWithParties | null>;

  listByClient(
    clientId: string,
    filter: { status?: PensionStatus },
    page: PageRequest,
  ): Promise<Page<PensionWithParties>>;

  listByRestaurant(
    restaurantId: string,
    filter: { status?: PensionStatus },
    page: PageRequest,
  ): Promise<Page<PensionWithParties>>;

  /** ACTIVE pensions with endDate in [from, to) — the vencimientos view. */
  listExpiring(
    restaurantId: string,
    from: Date,
    to: Date,
    page: PageRequest,
  ): Promise<Page<PensionWithParties>>;

  listPayments(pensionId: string): Promise<PaymentSnapshot[]>;
  sumConfirmedPayments(pensionId: string): Promise<number>;

  /**
   * Runs `fn` inside one transaction holding SELECT ... FOR UPDATE on the
   * pension row: payment activation and status changes cannot interleave.
   */
  withLockedPension<T>(
    pensionId: string,
    fn: (ops: LockedPensionOps) => Promise<T>,
  ): Promise<T>;

  /** Bulk-expires ACTIVE pensions whose endDate <= todayUtc. Returns count. */
  expireDue(todayUtc: Date): Promise<number>;
}
