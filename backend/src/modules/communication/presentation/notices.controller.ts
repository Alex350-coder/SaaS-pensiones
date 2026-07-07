import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { NoticesService } from '../application/notices.service';
import { PublishNoticeDto } from './dto/notices.dto';

const MINUTE_MS = 60_000;

/** Owner surface: publish avisos and review their reach. */
@Roles(UserRole.RESTAURANT_ADMIN)
@Controller('restaurants/mine/notices')
export class MyNoticesController {
  constructor(private readonly notices: NoticesService) {}

  // Each publish fans out one notification per ACTIVE pensioner; cap the rate
  // so the broadcast cannot be abused for write amplification.
  @Throttle({ default: { limit: 10, ttl: MINUTE_MS } })
  @Post()
  publish(
    @CurrentUser() user: AuthUser,
    @Body() dto: PublishNoticeDto,
  ): ReturnType<NoticesService['publish']> {
    return this.notices.publish(user.userId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): ReturnType<NoticesService['listMine']> {
    return this.notices.listMine(user.userId, query);
  }
}

/**
 * Notice detail for both sides. A recipient opening the aviso is what marks
 * it read (notice_reads + their bell entry) — see NoticesService.getForUser.
 */
@Roles(UserRole.CLIENT, UserRole.RESTAURANT_ADMIN)
@Controller('notices')
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): ReturnType<NoticesService['getForUser']> {
    return this.notices.getForUser(id, user.userId);
  }
}
