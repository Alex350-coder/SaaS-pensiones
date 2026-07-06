import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PensionQueriesService } from './application/pension-queries.service';
import { CLOCK } from './application/ports/clock.port';
import { PENSION_REPOSITORY } from './application/ports/pension.repository';
import { ChangePensionStatusUseCase } from './application/use-cases/change-pension-status.usecase';
import { ContractPensionUseCase } from './application/use-cases/contract-pension.usecase';
import { ExpirePensionsUseCase } from './application/use-cases/expire-pensions.usecase';
import { RegisterPaymentUseCase } from './application/use-cases/register-payment.usecase';
import { PensionExpirationJob } from './infrastructure/pension-expiration.job';
import { PensionPrismaRepository } from './infrastructure/prisma/pension-prisma.repository';
import { SystemClock } from './infrastructure/system-clock';
import { MyPensionsController } from './presentation/my-pensions.controller';
import { RestaurantPensionsController } from './presentation/restaurant-pensions.controller';

/**
 * Pensions bounded context — rich domain rules, full hexagonal wiring
 * (docs/arquitectura.md §4): ports resolved to adapters here and only here.
 */
@Module({
  imports: [CoreModule, CatalogModule],
  controllers: [MyPensionsController, RestaurantPensionsController],
  providers: [
    { provide: PENSION_REPOSITORY, useClass: PensionPrismaRepository },
    { provide: CLOCK, useClass: SystemClock },
    ContractPensionUseCase,
    RegisterPaymentUseCase,
    ChangePensionStatusUseCase,
    ExpirePensionsUseCase,
    PensionQueriesService,
    PensionExpirationJob,
  ],
  exports: [ExpirePensionsUseCase],
})
export class PensionsModule {}
