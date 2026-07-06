import { Injectable } from '@nestjs/common';
import {
  AttendanceStatus,
  PensionStatus,
  Prisma,
  ReservationStatus,
} from '@prisma/client';
import { formatUtcDate, parseUtcDate, todayUtc } from '../../../core/dates/utc-date';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import {
  buildProjection,
  ProductionProjection,
} from '../domain/production-projection';

export interface ProductionProjectionView extends ProductionProjection {
  date: string;
}

@Injectable()
export class ProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurants: RestaurantsService,
  ) {}

  /**
   * Proyección de producción for one day (roadmap F7). Every bucket is
   * scoped to pensions that are ACTIVE and cover the day, so answers left
   * behind by pensions that were later suspended/cancelled do not distort
   * the kitchen numbers; the three buckets always partition the active
   * pensioners (see domain/production-projection).
   */
  async getForDay(
    ownerId: string,
    dateStr?: string,
  ): Promise<ProductionProjectionView> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const date = dateStr ? parseUtcDate(dateStr) : todayUtc();

    const coveringActivePension: Prisma.PensionWhereInput = {
      restaurantId,
      status: PensionStatus.ACTIVE,
      startDate: { lte: date },
      endDate: { gt: date },
    };
    const answerFor = (status: AttendanceStatus): Prisma.AttendanceWhereInput => ({
      restaurantId,
      attendanceDate: date,
      status,
      pension: coveringActivePension,
    });

    const [activePensioners, willAttend, willNotAttend, confirmedReservations] =
      await this.prisma.$transaction([
        this.prisma.pension.count({ where: coveringActivePension }),
        this.prisma.attendance.count({
          where: answerFor(AttendanceStatus.WILL_ATTEND),
        }),
        this.prisma.attendance.count({
          where: answerFor(AttendanceStatus.WILL_NOT_ATTEND),
        }),
        this.prisma.reservation.count({
          where: {
            status: ReservationStatus.CONFIRMED,
            dailyMenu: { restaurantId, menuDate: date },
          },
        }),
      ]);

    return {
      date: formatUtcDate(date),
      ...buildProjection({
        activePensioners,
        willAttend,
        willNotAttend,
        confirmedReservations,
      }),
    };
  }
}
