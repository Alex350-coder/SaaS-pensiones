import { PaymentMethod, PensionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../core/http/pagination/pagination-query.dto';

export class ContractPensionDto {
  @IsUUID()
  restaurantId!: string;
}

export class RegisterPaymentDto {
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número con máximo 2 decimales.' },
  )
  @Min(0.01)
  @Max(99_999_999.99)
  amount!: number;

  @IsIn(Object.values(PaymentMethod), {
    message: 'El método debe ser CASH, TRANSFER o CARD.',
  })
  method!: PaymentMethod;

  /** When the money actually changed hands; defaults to now. */
  @IsOptional()
  @IsISO8601()
  paidAt?: string;
}

/** Targets a restaurant may set. ACTIVE here means reactivate a SUSPENDED. */
export class ChangePensionStatusDto {
  @IsIn([PensionStatus.ACTIVE, PensionStatus.SUSPENDED, PensionStatus.CANCELLED], {
    message: 'El estado debe ser ACTIVE, SUSPENDED o CANCELLED.',
  })
  status!: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
}

export class ListPensionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(PensionStatus))
  status?: PensionStatus;
}

export class ExpiringPensionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  days?: number;
}
