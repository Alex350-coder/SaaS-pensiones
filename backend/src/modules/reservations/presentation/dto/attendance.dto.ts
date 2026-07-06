import { AttendanceStatus } from '@prisma/client';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { UTC_DATE_PATTERN } from '../../../../core/dates/utc-date';
import { PaginationQueryDto } from '../../../../core/http/pagination/pagination-query.dto';

/** Only the pensioner-facing answers; ATTENDED/NO_SHOW are set later by ops. */
const CONFIRMABLE_STATUSES = [
  AttendanceStatus.WILL_ATTEND,
  AttendanceStatus.WILL_NOT_ATTEND,
] as const;

export class ConfirmAttendanceDto {
  @IsUUID()
  pensionId!: string;

  @Matches(UTC_DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  date!: string;

  @IsIn(CONFIRMABLE_STATUSES, {
    message: 'El estado debe ser WILL_ATTEND o WILL_NOT_ATTEND.',
  })
  status!: (typeof CONFIRMABLE_STATUSES)[number];
}

export class ListAttendanceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  pensionId?: string;
}
