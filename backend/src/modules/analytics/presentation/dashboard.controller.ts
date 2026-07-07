import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { DashboardService } from '../application/dashboard.service';

/** Owner dashboard: live metrics for the caller's own restaurant. */
@Roles(UserRole.RESTAURANT_ADMIN)
@Controller('restaurants/mine/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  metrics(
    @CurrentUser() user: AuthUser,
  ): ReturnType<DashboardService['getForOwner']> {
    return this.dashboard.getForOwner(user.userId);
  }
}
