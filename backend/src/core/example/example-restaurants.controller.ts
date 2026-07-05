import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { Paginated } from '../http/pagination/paginated';
import { PaginationQueryDto } from '../http/pagination/pagination-query.dto';
import {
  ExampleRestaurantItem,
  ExampleRestaurantsService,
} from './example-restaurants.service';

/** TEMPORARY — see ExampleRestaurantsService. Removed in Phase 4. */
@Public()
@Controller('example/restaurants')
export class ExampleRestaurantsController {
  constructor(private readonly service: ExampleRestaurantsService) {}

  @Get()
  list(
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ExampleRestaurantItem>> {
    return this.service.findApproved(query);
  }
}
