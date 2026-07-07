import { Injectable } from '@nestjs/common';
import { PaymentStatus, PensionStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import { ProjectionService } from '../../reservations/application/projection.service';

export interface DashboardMetrics {
  /** Day the projection is computed for (UTC, YYYY-MM-DD). */
  date: string;
  /** ACTIVE pensions of the restaurant covering today. */
  activePensioners: number;
  /**
   * Pensions still awaiting payment. `amount` is the outstanding balance
   * (contract price minus confirmed payments), so partial payments are
   * reflected — payments are only ever created CONFIRMED, so there is no
   * PENDING payment row to count directly.
   */
  pendingPayments: { count: number; amount: number };
  /** CONFIRMED reservations against today's menu. */
  todayReservations: number;
  /** Conservative kitchen figure: confirmed attendees + unanswered. */
  projectedAttendance: number;
  /** Committed monthly revenue: sum of ACTIVE pension prices. */
  estimatedRevenue: number;
}

/**
 * Restaurant owner dashboard (roadmap F10). Read-only aggregation across the
 * pension/payment/reservation aggregates — every figure is derived straight
 * from the rows, so it reconciles against the raw data by construction.
 *
 * Attendance-side figures reuse ProjectionService so the dashboard and the
 * kitchen projection can never drift apart.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurants: RestaurantsService,
    private readonly projection: ProjectionService,
  ) {}

  async getForOwner(ownerId: string): Promise<DashboardMetrics> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const projection = await this.projection.getForDay(ownerId);

    const awaitingPayment = {
      restaurantId,
      status: PensionStatus.PENDING_PAYMENT,
    };
    const [pendingAgg, paidOnPending, revenueAgg] =
      await this.prisma.$transaction([
        this.prisma.pension.aggregate({
          where: awaitingPayment,
          _count: true,
          _sum: { price: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            status: PaymentStatus.CONFIRMED,
            pension: awaitingPayment,
          },
          _sum: { amount: true },
        }),
        this.prisma.pension.aggregate({
          where: { restaurantId, status: PensionStatus.ACTIVE },
          _sum: { price: true },
        }),
      ]);

    const owed = Number(pendingAgg._sum.price ?? 0);
    const collected = Number(paidOnPending._sum.amount ?? 0);

    return {
      date: projection.date,
      activePensioners: projection.pensioners.active,
      pendingPayments: {
        count: pendingAgg._count,
        // Never surface a negative balance if an overpayment ever slips in.
        amount: Math.max(0, owed - collected),
      },
      todayReservations: projection.reservations.confirmed,
      projectedAttendance: projection.projectedAttendance,
      estimatedRevenue: Number(revenueAgg._sum.price ?? 0),
    };
  }
}
