import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  PHONE_PATTERN,
  PHONE_PATTERN_MESSAGE,
} from '../../../../core/http/validation/patterns';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRestaurantDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  name!: string;

  @Transform(trim)
  @IsString()
  @Length(10, 2000, {
    message: 'La descripción debe tener entre 10 y 2000 caracteres.',
  })
  description!: string;

  @Transform(trim)
  @IsString()
  @Length(5, 255, {
    message: 'La dirección debe tener entre 5 y 255 caracteres.',
  })
  address!: string;

  @IsString()
  @Matches(PHONE_PATTERN, { message: PHONE_PATTERN_MESSAGE })
  contactPhone!: string;

  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo de contacto no tiene un formato válido.' })
  contactEmail!: string;

  // Decimal(10,2) in DB.
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio mensual debe ser un número con máximo 2 decimales.' },
  )
  @Min(0.01)
  @Max(99_999_999.99)
  monthlyPensionPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  logoUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  coverImageUrl?: string;
}
