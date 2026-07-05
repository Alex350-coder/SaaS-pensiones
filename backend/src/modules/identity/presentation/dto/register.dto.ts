import { UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MaxBytes } from '../../../../core/http/validation/max-bytes.decorator';

/** Roles a visitor can self-register as. SUPER_ADMIN only exists via seed. */
export const SELF_REGISTER_ROLES = [
  UserRole.CLIENT,
  UserRole.RESTAURANT_ADMIN,
] as const;

export class RegisterDto {
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  // bcrypt only uses the first 72 BYTES; multi-byte chars count per byte.
  @MaxBytes(72, {
    message: 'La contraseña es demasiado larga (máximo 72 bytes).',
  })
  password!: string;

  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  fullName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s()-]{6,30}$/, {
    message: 'El teléfono no tiene un formato válido.',
  })
  phone?: string;

  @IsOptional()
  @IsIn(SELF_REGISTER_ROLES, {
    message: 'El rol debe ser CLIENT o RESTAURANT_ADMIN.',
  })
  role?: (typeof SELF_REGISTER_ROLES)[number];
}
