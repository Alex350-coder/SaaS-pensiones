import {
  Body,
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
import { PensionQueriesService } from '../application/pension-queries.service';
import { ChangePensionStatusUseCase } from '../application/use-cases/change-pension-status.usecase';
import { ContractPensionUseCase } from '../application/use-cases/contract-pension.usecase';
import {
  ContractPensionDto,
  ListPensionsQueryDto,
} from './dto/pension.dto';

/** Client surface: contract, follow and cancel their own pensions. */
@Roles(UserRole.CLIENT)
@Controller('pensions')
export class MyPensionsController {
  constructor(
    private readonly contractPension: ContractPensionUseCase,
    private readonly changeStatus: ChangePensionStatusUseCase,
    private readonly queries: PensionQueriesService,
  ) {}

  @Post()
  contract(
    @CurrentUser() user: AuthUser,
    @Body() dto: ContractPensionDto,
  ): ReturnType<ContractPensionUseCase['execute']> {
    return this.contractPension.execute(user.userId, dto.restaurantId);
  }

  @Get('mine')
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListPensionsQueryDto,
  ): ReturnType<PensionQueriesService['listMine']> {
    return this.queries.listMine(user.userId, query, query.status);
  }

  @Get('mine/:id')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): ReturnType<PensionQueriesService['getMine']> {
    return this.queries.getMine(user.userId, id);
  }

  @Post('mine/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): ReturnType<ChangePensionStatusUseCase['cancelAsClient']> {
    return this.changeStatus.cancelAsClient(user.userId, id);
  }
}
