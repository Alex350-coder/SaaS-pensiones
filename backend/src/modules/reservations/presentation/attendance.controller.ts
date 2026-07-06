import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { AttendanceService } from '../application/attendance.service';
import {
  ConfirmAttendanceDto,
  ListAttendanceQueryDto,
} from './dto/attendance.dto';

/**
 * Client surface: daily "asistiré / no asistiré". PUT because confirming is
 * an idempotent upsert on (pension, date) — re-answering replaces the answer.
 */
@Roles(UserRole.CLIENT)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Put()
  confirm(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmAttendanceDto,
  ): ReturnType<AttendanceService['confirm']> {
    return this.attendance.confirm(user.userId, dto);
  }

  @Get('mine')
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAttendanceQueryDto,
  ): ReturnType<AttendanceService['listMine']> {
    return this.attendance.listMine(user.userId, query);
  }
}
