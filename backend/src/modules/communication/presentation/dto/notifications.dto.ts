import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../../core/http/pagination/pagination-query.dto';

export class NotificationsQueryDto extends PaginationQueryDto {
  /** ?unread=true narrows the bell list to pending items. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unread?: boolean;
}
