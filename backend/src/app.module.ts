import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { IdentityModule } from './modules/identity/identity.module';
import { MenuModule } from './modules/menu/menu.module';
import { PensionsModule } from './modules/pensions/pensions.module';
import { ReservationsModule } from './modules/reservations/reservations.module';

/** Bounded-context modules (src/modules/*) are added here phase by phase. */
@Module({
  imports: [
    CoreModule,
    IdentityModule,
    CatalogModule,
    MenuModule,
    PensionsModule,
    ReservationsModule,
    CommunicationModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
