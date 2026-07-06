import {
  Body,
  Controller,
  Get,
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
import { PensionQueriesService } from '../application/pension-queries.service';
import { ChangePensionStatusUseCase } from '../application/use-cases/change-pension-status.usecase';
import { RegisterPaymentUseCase } from '../application/use-cases/register-payment.usecase';
import {
  ChangePensionStatusDto,
  ExpiringPensionsQueryDto,
  ListPensionsQueryDto,
  RegisterPaymentDto,
} from './dto/pension.dto';

const DEFAULT_EXPIRING_WINDOW_DAYS = 7;

/** Restaurant surface: pensioners, payments, dunning view, lifecycle. */
@Roles(UserRole.RESTAURANT_ADMIN)
@Controller('restaurants/mine/pensions')
export class RestaurantPensionsController {
  constructor(
    private readonly registerPayment: RegisterPaymentUseCase,
    private readonly changeStatus: ChangePensionStatusUseCase,
    private readonly queries: PensionQueriesService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListPensionsQueryDto,
  ): ReturnType<PensionQueriesService['listForRestaurant']> {
    return this.queries.listForRestaurant(user.userId, query, query.status);
  }

  @Get('expiring')
  listExpiring(
    @CurrentUser() user: AuthUser,
    @Query() query: ExpiringPensionsQueryDto,
  ): ReturnType<PensionQueriesService['listExpiring']> {
    return this.queries.listExpiring(
      user.userId,
      query.days ?? DEFAULT_EXPIRING_WINDOW_DAYS,
      query,
    );
  }

  @Get(':id')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): ReturnType<PensionQueriesService['getForRestaurant']> {
    return this.queries.getForRestaurant(user.userId, id);
  }

  @Post(':id/payments')
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterPaymentDto,
  ): ReturnType<RegisterPaymentUseCase['execute']> {
    return this.registerPayment.execute(user.userId, id, {
      amount: dto.amount,
      method: dto.method,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
    });
  }

  @Patch(':id/status')
  transition(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePensionStatusDto,
  ): ReturnType<ChangePensionStatusUseCase['changeAsRestaurant']> {
    return this.changeStatus.changeAsRestaurant(user.userId, id, dto.status);
  }
}
