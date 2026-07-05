import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { RestaurantsService } from './application/restaurants.service';
import { AdminRestaurantsController } from './presentation/admin-restaurants.controller';
import { MyRestaurantController } from './presentation/my-restaurant.controller';
import { PublicCatalogController } from './presentation/public-catalog.controller';

/**
 * Restaurant Catalog bounded context (simple CRUD: collapsed service, no
 * ports — ADR #2). Controller order matters: static paths (mine, admin)
 * must register before the public `:slug` route.
 */
@Module({
  imports: [CoreModule],
  controllers: [
    MyRestaurantController,
    AdminRestaurantsController,
    PublicCatalogController,
  ],
  providers: [RestaurantsService],
  exports: [RestaurantsService],
})
export class CatalogModule {}
