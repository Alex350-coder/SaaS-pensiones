import { Injectable } from '@nestjs/common';
import { Payment, Pension, Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../../core/prisma/prisma.service';
import { PensionSnapshot, PensionStatus } from '../../domain/pension';
import { LivePensionExistsError } from '../../domain/pension.errors';
import {
  LockedPensionOps,
  Page,
  PageRequest,
  PaymentSnapshot,
  PensionRepository,
  PensionWithParties,
} from '../../application/ports/pension.repository';

type PensionRow = Pension & {
  client: Pick<User, 'id' | 'fullName' | 'email'>;
  restaurant: { id: string; name: string; slug: string };
};

const PARTY_INCLUDE = {
  client: { select: { id: true, fullName: true, email: true } },
  restaurant: { select: { id: true, name: true, slug: true } },
} as const;

@Injectable()
export class PensionPrismaRepository implements PensionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    clientId: string;
    restaurantId: string;
    price: number;
    startDate: Date;
    endDate: Date;
  }): Promise<PensionSnapshot> {
    try {
      const row = await this.prisma.pension.create({ data: input });
      return this.toSnapshot(row);
    } catch (error) {
      if (this.isLivePensionViolation(error)) {
        throw new LivePensionExistsError();
      }
      throw error;
    }
  }

  async findForClient(
    id: string,
    clientId: string,
  ): Promise<PensionWithParties | null> {
    const row = await this.prisma.pension.findFirst({
      where: { id, clientId },
      include: PARTY_INCLUDE,
    });
    return row ? this.toWithParties(row) : null;
  }

  async findForRestaurant(
    id: string,
    restaurantId: string,
  ): Promise<PensionWithParties | null> {
    const row = await this.prisma.pension.findFirst({
      where: { id, restaurantId },
      include: PARTY_INCLUDE,
    });
    return row ? this.toWithParties(row) : null;
  }

  listByClient(
    clientId: string,
    filter: { status?: PensionStatus },
    page: PageRequest,
  ): Promise<Page<PensionWithParties>> {
    return this.listWhere(
      { clientId, ...(filter.status ? { status: filter.status } : {}) },
      { createdAt: 'desc' },
      page,
    );
  }

  listByRestaurant(
    restaurantId: string,
    filter: { status?: PensionStatus },
    page: PageRequest,
  ): Promise<Page<PensionWithParties>> {
    return this.listWhere(
      { restaurantId, ...(filter.status ? { status: filter.status } : {}) },
      { createdAt: 'desc' },
      page,
    );
  }

  listExpiring(
    restaurantId: string,
    from: Date,
    to: Date,
    page: PageRequest,
  ): Promise<Page<PensionWithParties>> {
    return this.listWhere(
      { restaurantId, status: 'ACTIVE', endDate: { gte: from, lt: to } },
      { endDate: 'asc' },
      page,
    );
  }

  async listPayments(pensionId: string): Promise<PaymentSnapshot[]> {
    const rows = await this.prisma.payment.findMany({
      where: { pensionId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toPaymentSnapshot(row));
  }

  async sumConfirmedPayments(pensionId: string): Promise<number> {
    return this.sumConfirmed(this.prisma, pensionId);
  }

  async withLockedPension<T>(
    pensionId: string,
    fn: (ops: LockedPensionOps) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM pensions WHERE id = ${pensionId}::uuid FOR UPDATE`;
      return fn(this.lockedOps(tx, pensionId));
    });
  }

  async expireDue(todayUtc: Date): Promise<number> {
    const result = await this.prisma.pension.updateMany({
      where: { status: 'ACTIVE', endDate: { lte: todayUtc } },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  }

  // --- Internals -------------------------------------------------------------

  private lockedOps(
    tx: Prisma.TransactionClient,
    pensionId: string,
  ): LockedPensionOps {
    return {
      getPension: async () => {
        const row = await tx.pension.findUnique({ where: { id: pensionId } });
        return row ? this.toSnapshot(row) : null;
      },
      sumConfirmedPayments: () => this.sumConfirmed(tx, pensionId),
      createConfirmedPayment: async (input) => {
        const row = await tx.payment.create({
          data: {
            pensionId,
            amount: input.amount,
            method: input.method,
            status: 'CONFIRMED',
            paidAt: input.paidAt,
            registeredById: input.registeredById,
          },
        });
        return this.toPaymentSnapshot(row);
      },
      activate: async (startDate, endDate) => {
        const row = await tx.pension.update({
          where: { id: pensionId },
          data: { status: 'ACTIVE', startDate, endDate },
        });
        return this.toSnapshot(row);
      },
      updateStatus: async (status) => {
        const row = await tx.pension.update({
          where: { id: pensionId },
          data: { status },
        });
        return this.toSnapshot(row);
      },
      voidConfirmedPayments: async () => {
        const result = await tx.payment.updateMany({
          where: { pensionId, status: 'CONFIRMED' },
          data: { status: 'VOIDED' },
        });
        return result.count;
      },
    };
  }

  private async sumConfirmed(
    db: Prisma.TransactionClient | PrismaService,
    pensionId: string,
  ): Promise<number> {
    const aggregate = await db.payment.aggregate({
      where: { pensionId, status: 'CONFIRMED' },
      _sum: { amount: true },
    });
    return Number(aggregate._sum.amount ?? 0);
  }

  private async listWhere(
    where: Prisma.PensionWhereInput,
    orderBy: Prisma.PensionOrderByWithRelationInput,
    page: PageRequest,
  ): Promise<Page<PensionWithParties>> {
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.pension.count({ where }),
      this.prisma.pension.findMany({
        where,
        include: PARTY_INCLUDE,
        orderBy,
        skip: page.skip,
        take: page.take,
      }),
    ]);
    return { total, items: rows.map((row) => this.toWithParties(row)) };
  }

  private toSnapshot(row: Pension): PensionSnapshot {
    return {
      id: row.id,
      clientId: row.clientId,
      restaurantId: row.restaurantId,
      startDate: row.startDate,
      endDate: row.endDate,
      price: Number(row.price),
      status: row.status,
      createdAt: row.createdAt,
    };
  }

  private toWithParties(row: PensionRow): PensionWithParties {
    return {
      ...this.toSnapshot(row),
      client: row.client,
      restaurant: row.restaurant,
    };
  }

  private toPaymentSnapshot(row: Payment): PaymentSnapshot {
    return {
      id: row.id,
      pensionId: row.pensionId,
      amount: Number(row.amount),
      method: row.method,
      status: row.status,
      paidAt: row.paidAt,
      registeredById: row.registeredById,
    };
  }

  private isLivePensionViolation(error: unknown): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return true;
    }
    return (
      error instanceof Error &&
      error.message.includes('uq_live_pension_per_client_restaurant')
    );
  }
}
