import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { InvoicesService } from '../application/invoices.service';
import { sendInvoicePdf } from './send-invoice-pdf';

/** On-demand PDF rendering is heavier than a JSON read, so cap it per user. */
const MINUTE_MS = 60_000;
const PDF_LIMIT_PER_MINUTE = 30;

/** Restaurant owner surface: history of invoices emitted for its pensions. */
@Roles(UserRole.RESTAURANT_ADMIN)
@Controller('restaurants/mine/invoices')
export class RestaurantInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): ReturnType<InvoicesService['listForRestaurant']> {
    return this.invoices.listForRestaurant(user.userId, query);
  }

  @Throttle({ default: { limit: PDF_LIMIT_PER_MINUTE, ttl: MINUTE_MS } })
  @Get(':id/pdf')
  async pdf(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.invoices.pdfForRestaurant(user.userId, id);
    sendInvoicePdf(res, buffer, id);
  }
}
