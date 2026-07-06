import { ReservationStatus } from '@prisma/client';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { UTC_DATE_PATTERN } from '../../../../core/dates/utc-date';
import { PaginationQueryDto } from '../../../../core/http/pagination/pagination-query.dto';

/** Wall-clock arrival time, HH:MM 24h (the DB column is time(0)). */
export const ARRIVAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const ARRIVAL_TIME_MESSAGE =
  'La hora estimada de llegada debe tener formato HH:MM (24 horas).';

export class CreateReservationDto {
  @IsUUID()
  dailyMenuId!: string;

  @Matches(ARRIVAL_TIME_PATTERN, { message: ARRIVAL_TIME_MESSAGE })
  estimatedArrival!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

/**
 * PATCH body. `estimatedArrival` maps to a NOT NULL column, so explicit null
 * must fail validation — hence ValidateIf on undefined instead of IsOptional
 * (the Phase 4/5 null-bypass lesson). `notes` is nullable: null clears it.
 */
export class UpdateReservationDto {
  @ValidateIf((_, value) => value !== undefined)
  @Matches(ARRIVAL_TIME_PATTERN, { message: ARRIVAL_TIME_MESSAGE })
  estimatedArrival?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string | null;
}

export class ListReservationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(ReservationStatus))
  status?: ReservationStatus;
}

/** Day selector for restaurant views; defaults to today (UTC) in the service. */
export class DayQueryDto {
  @IsOptional()
  @Matches(UTC_DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  date?: string;
}

/** Reservas del día: day selector + optional status filter + pagination. */
export class RestaurantDayQueryDto extends ListReservationsQueryDto {
  @IsOptional()
  @Matches(UTC_DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  date?: string;
}
