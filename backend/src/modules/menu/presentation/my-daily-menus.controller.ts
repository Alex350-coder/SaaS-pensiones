import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { DailyMenusService } from '../application/daily-menus.service';
import {
  ChangeMenuStatusDto,
  CreateDailyMenuDto,
  ReplaceMenuItemsDto,
  UpdateDailyMenuDto,
} from './dto/daily-menu.dto';

/** Daily menus of the caller's own restaurant, keyed by calendar date. */
@Roles(UserRole.RESTAURANT_ADMIN)
@Controller('restaurants/mine/menus')
export class MyDailyMenusController {
  constructor(private readonly menus: DailyMenusService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): ReturnType<DailyMenusService['list']> {
    return this.menus.list(user.userId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDailyMenuDto,
  ): ReturnType<DailyMenusService['create']> {
    return this.menus.create(user.userId, dto);
  }

  @Get(':date')
  get(
    @CurrentUser() user: AuthUser,
    @Param('date') date: string,
  ): ReturnType<DailyMenusService['getByDate']> {
    return this.menus.getByDate(user.userId, date);
  }

  @Patch(':date')
  updatePrice(
    @CurrentUser() user: AuthUser,
    @Param('date') date: string,
    @Body() dto: UpdateDailyMenuDto,
  ): ReturnType<DailyMenusService['updatePrice']> {
    return this.menus.updatePrice(user.userId, date, dto.menuPrice);
  }

  @Put(':date/items')
  replaceItems(
    @CurrentUser() user: AuthUser,
    @Param('date') date: string,
    @Body() dto: ReplaceMenuItemsDto,
  ): ReturnType<DailyMenusService['replaceItems']> {
    return this.menus.replaceItems(user.userId, date, dto.items);
  }

  @Patch(':date/status')
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('date') date: string,
    @Body() dto: ChangeMenuStatusDto,
  ): ReturnType<DailyMenusService['changeStatus']> {
    return this.menus.changeStatus(user.userId, date, dto.status);
  }

  @Delete(':date')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('date') date: string,
  ): Promise<null> {
    await this.menus.remove(user.userId, date);
    return null;
  }
}
