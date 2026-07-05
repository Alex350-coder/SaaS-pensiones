import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  TIME_PATTERN,
  TIME_PATTERN_MESSAGE,
} from '../../../../core/http/validation/patterns';

export class ScheduleItemDto {
  /** 0 = domingo … 6 = sábado (DB CHECK chk_schedule_day_range). */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @Matches(TIME_PATTERN, { message: TIME_PATTERN_MESSAGE })
  opensAt!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: TIME_PATTERN_MESSAGE })
  closesAt!: string;
}

/** Full weekly replacement: days absent from the list are closed days. */
export class UpdateSchedulesDto {
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  schedules!: ScheduleItemDto[];
}
