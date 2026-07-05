import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { RestaurantsService } from '../application/restaurants.service';
import { AddImageDto } from './dto/add-image.dto';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { UpdateSchedulesDto } from './dto/update-schedules.dto';

/**
 * Owner surface. Ownership is structural: every operation resolves the
 * restaurant from the authenticated user, never from a client-supplied id —
 * a RESTAURANT_ADMIN cannot even name someone else's restaurant here.
 */
@Roles(UserRole.RESTAURANT_ADMIN)
@Controller('restaurants/mine')
export class MyRestaurantController {
  constructor(private readonly restaurants: RestaurantsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRestaurantDto,
  ): ReturnType<RestaurantsService['createOwn']> {
    return this.restaurants.createOwn(user.userId, dto);
  }

  @Get()
  get(@CurrentUser() user: AuthUser): ReturnType<RestaurantsService['getOwn']> {
    return this.restaurants.getOwn(user.userId);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRestaurantDto,
  ): ReturnType<RestaurantsService['updateOwn']> {
    return this.restaurants.updateOwn(user.userId, dto);
  }

  @Put('schedules')
  replaceSchedules(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSchedulesDto,
  ): ReturnType<RestaurantsService['replaceSchedules']> {
    return this.restaurants.replaceSchedules(user.userId, dto.schedules);
  }

  @Post('images')
  addImage(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddImageDto,
  ): ReturnType<RestaurantsService['addImage']> {
    return this.restaurants.addImage(user.userId, dto.url);
  }

  @Delete('images/:imageId')
  @HttpCode(HttpStatus.OK)
  async removeImage(
    @CurrentUser() user: AuthUser,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<null> {
    await this.restaurants.removeImage(user.userId, imageId);
    return null;
  }
}
