import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { AdminUsersService } from '../application/admin-users.service';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';

class AdminUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(UserRole))
  role?: UserRole;

  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;
}

/** User administration: only the Super Admin lists and suspends accounts. */
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(
    @Query() query: AdminUsersQueryDto,
  ): ReturnType<AdminUsersService['list']> {
    return this.users.list(query, { role: query.role, status: query.status });
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserStatusDto,
  ): ReturnType<AdminUsersService['changeStatus']> {
    return this.users.changeStatus(user.userId, id, dto.status);
  }
}
