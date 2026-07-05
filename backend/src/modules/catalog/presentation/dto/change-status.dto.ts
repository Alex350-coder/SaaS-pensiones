import { RestaurantStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

/** Target states a Super Admin can set. PENDING is never a target. */
export const STATUS_TARGETS = [
  RestaurantStatus.APPROVED,
  RestaurantStatus.SUSPENDED,
] as const;

export class ChangeStatusDto {
  @IsIn(STATUS_TARGETS, {
    message: 'El estado debe ser APPROVED o SUSPENDED.',
  })
  status!: (typeof STATUS_TARGETS)[number];
}
