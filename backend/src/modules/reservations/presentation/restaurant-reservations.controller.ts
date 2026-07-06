import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { ProjectionService } from '../application/projection.service';
import { ReservationsService } from '../application/reservations.service';
import { DayQueryDto, RestaurantDayQueryDto } from './dto/reservation.dto';

/** Restaurant surface: reservas del día + proyección de producción. */
@Roles(UserRole.RESTAURANT_ADMIN)
@Controller('restaurants/mine')
export class RestaurantReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly projection: ProjectionService,
  ) {}

  @Get('reservations')
  listDay(
    @CurrentUser() user: AuthUser,
    @Query() query: RestaurantDayQueryDto,
  ): ReturnType<ReservationsService['listForRestaurantDay']> {
    return this.reservations.listForRestaurantDay(user.userId, query);
  }

  @Get('production-projection')
  projectionForDay(
    @CurrentUser() user: AuthUser,
    @Query() query: DayQueryDto,
  ): ReturnType<ProjectionService['getForDay']> {
    return this.projection.getForDay(user.userId, query.date);
  }
}
