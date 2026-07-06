import {
  Body,
  Controller,
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
import { ReservationsService } from '../application/reservations.service';
import {
  CreateReservationDto,
  ListReservationsQueryDto,
  UpdateReservationDto,
} from './dto/reservation.dto';

/** Client surface: reserve the day's menu, follow and cancel reservations. */
@Roles(UserRole.CLIENT)
@Controller('reservations')
export class MyReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReservationDto,
  ): ReturnType<ReservationsService['create']> {
    return this.reservations.create(user.userId, dto);
  }

  @Get('mine')
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListReservationsQueryDto,
  ): ReturnType<ReservationsService['listMine']> {
    return this.reservations.listMine(user.userId, query);
  }

  @Get('mine/:id')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): ReturnType<ReservationsService['getMine']> {
    return this.reservations.getMine(user.userId, id);
  }

  @Patch('mine/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
  ): ReturnType<ReservationsService['update']> {
    return this.reservations.update(user.userId, id, dto);
  }

  @Post('mine/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): ReturnType<ReservationsService['cancel']> {
    return this.reservations.cancel(user.userId, id);
  }
}
