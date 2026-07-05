import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { RestaurantStatus, UserRole } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { RestaurantsService } from '../application/restaurants.service';
import { ChangeStatusDto } from './dto/change-status.dto';

class AdminListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(RestaurantStatus))
  status?: RestaurantStatus;
}

/** Platform curation: only the Super Admin mutates restaurant lifecycle. */
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/restaurants')
export class AdminRestaurantsController {
  constructor(private readonly restaurants: RestaurantsService) {}

  @Get()
  list(
    @Query() query: AdminListQueryDto,
  ): ReturnType<RestaurantsService['adminList']> {
    return this.restaurants.adminList(query, query.status);
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ): ReturnType<RestaurantsService['changeStatus']> {
    return this.restaurants.changeStatus(user.userId, id, dto.status);
  }
}
