import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../../core/auth/public.decorator';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { RestaurantsService } from '../application/restaurants.service';

/** Public catalog: only APPROVED, live restaurants are ever visible. */
@Public()
@Controller('restaurants')
export class PublicCatalogController {
  constructor(private readonly restaurants: RestaurantsService) {}

  @Get()
  list(
    @Query() query: PaginationQueryDto,
  ): ReturnType<RestaurantsService['listPublic']> {
    return this.restaurants.listPublic(query);
  }

  @Get(':slug')
  detail(
    @Param('slug') slug: string,
  ): ReturnType<RestaurantsService['getPublicBySlug']> {
    return this.restaurants.getPublicBySlug(slug);
  }
}
