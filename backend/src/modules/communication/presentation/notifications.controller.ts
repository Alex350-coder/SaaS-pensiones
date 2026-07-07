import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { NotificationsService } from '../application/notifications.service';
import { NotificationsQueryDto } from './dto/notifications.dto';

/** The bell: every authenticated role has one. */
@Roles(UserRole.CLIENT, UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationsQueryDto,
  ): ReturnType<NotificationsService['listMine']> {
    return this.notifications.listMine(user.userId, query, query.unread);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser): Promise<{ unread: number }> {
    return { unread: await this.notifications.unreadCount(user.userId) };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): ReturnType<NotificationsService['markRead']> {
    return this.notifications.markRead(id, user.userId);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(
    @CurrentUser() user: AuthUser,
  ): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(user.userId) };
  }
}
