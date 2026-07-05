import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { IdentityModule } from './modules/identity/identity.module';

/** Bounded-context modules (src/modules/*) are added here phase by phase. */
@Module({
  imports: [CoreModule, IdentityModule, CatalogModule],
})
export class AppModule {}
