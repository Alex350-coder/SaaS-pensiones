import { IsIn } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class ChangeUserStatusDto {
  @IsIn(Object.values(UserStatus), {
    message: 'El estado debe ser ACTIVE o SUSPENDED.',
  })
  status!: UserStatus;
}
