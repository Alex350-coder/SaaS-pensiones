import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { CatalogModule } from '../catalog/catalog.module';
import { DailyMenusService } from './application/daily-menus.service';
import { DishesService } from './application/dishes.service';
import { MyDailyMenusController } from './presentation/my-daily-menus.controller';
import { MyDishesController } from './presentation/my-dishes.controller';
import { PublicMenuController } from './presentation/public-menu.controller';

/**
 * Menu Management bounded context (simple CRUD, ADR #2). Depends on Catalog
 * only through RestaurantsService (structural ownership resolution).
 */
@Module({
  imports: [CoreModule, CatalogModule],
  controllers: [MyDishesController, MyDailyMenusController, PublicMenuController],
  providers: [DishesService, DailyMenusService],
  exports: [DailyMenusService],
})
export class MenuModule {}
