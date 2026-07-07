import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { DashboardService } from './application/dashboard.service';
import { DashboardController } from './presentation/dashboard.controller';

/**
 * Analytics / reporting context (roadmap F10). A read-only surface that
 * aggregates across other bounded contexts (pensions, payments, reservations)
 * without owning any of them — it depends on their modules, never the reverse.
 */
@Module({
  imports: [CoreModule, CatalogModule, ReservationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class AnalyticsModule {}
