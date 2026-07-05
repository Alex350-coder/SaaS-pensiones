import { OmitType, PartialType } from '@nestjs/mapped-types';
import { DishCategory } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../core/http/pagination/pagination-query.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDishDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsIn(Object.values(DishCategory), {
    message: 'La categoría debe ser STARTER, MAIN, BEVERAGE o DESSERT.',
  })
  category!: DishCategory;

  // Decimal(10,2), CHECK price >= 0 (a beverage included in the menu can be 0).
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número con máximo 2 decimales.' },
  )
  @Min(0)
  @Max(99_999_999.99)
  price!: number;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * isActive is excluded from inheritance and redeclared: it maps to a NOT
 * NULL column, but the @IsOptional it carries in CreateDishDto would let an
 * explicit `null` skip validation entirely (IsOptional and the mapped-types
 * null guard AND together). @ValidateIf skips only `undefined`, so `null`
 * is validated — and rejected — by @IsBoolean. description/imageUrl keep
 * the inherited behavior on purpose: their columns are nullable and `null`
 * is the legitimate way to clear them.
 */
export class UpdateDishDto extends PartialType(
  OmitType(CreateDishDto, ['isActive'] as const),
  { skipNullProperties: false },
) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class ListDishesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(DishCategory))
  category?: DishCategory;

  /** Owners see inactive dishes too unless they filter. */
  @IsOptional()
  @Transform(({ value }): unknown =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}
