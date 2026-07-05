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
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { DishesService } from '../application/dishes.service';
import {
  CreateDishDto,
  ListDishesQueryDto,
  UpdateDishDto,
} from './dto/dish.dto';

/** Dish catalog of the caller's own restaurant (structural ownership). */
@Roles(UserRole.RESTAURANT_ADMIN)
@Controller('restaurants/mine/dishes')
export class MyDishesController {
  constructor(private readonly dishes: DishesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListDishesQueryDto,
  ): ReturnType<DishesService['list']> {
    return this.dishes.list(user.userId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDishDto,
  ): ReturnType<DishesService['create']> {
    return this.dishes.create(user.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDishDto,
  ): ReturnType<DishesService['update']> {
    return this.dishes.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    await this.dishes.remove(user.userId, id);
    return null;
  }
}
