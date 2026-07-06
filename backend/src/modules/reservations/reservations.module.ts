import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AttendanceService } from './application/attendance.service';
import { ProjectionService } from './application/projection.service';
import { ReservationsService } from './application/reservations.service';
import { AttendanceController } from './presentation/attendance.controller';
import { MyReservationsController } from './presentation/my-reservations.controller';
import { RestaurantReservationsController } from './presentation/restaurant-reservations.controller';

/**
 * Reservations & Attendance bounded context — lean hexagonal (ADR #2): the
 * rich rules (cutoffs, invariants #1/#3/#4, projection math) live as pure
 * functions in domain/, while services use Prisma directly like catalog/menu.
 */
@Module({
  imports: [CoreModule, CatalogModule],
  controllers: [
    MyReservationsController,
    AttendanceController,
    RestaurantReservationsController,
  ],
  providers: [ReservationsService, AttendanceService, ProjectionService],
})
export class ReservationsModule {}
