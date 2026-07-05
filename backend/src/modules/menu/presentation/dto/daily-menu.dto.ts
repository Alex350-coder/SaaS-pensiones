import { DishCategory, MenuStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const DATE_MESSAGE = 'La fecha debe tener formato YYYY-MM-DD.';

export class CreateDailyMenuDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  menuDate!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio del menú debe ser un número con máximo 2 decimales.' },
  )
  @Min(0.01)
  @Max(99_999_999.99)
  menuPrice!: number;
}

export class UpdateDailyMenuDto {
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio del menú debe ser un número con máximo 2 decimales.' },
  )
  @Min(0.01)
  @Max(99_999_999.99)
  menuPrice!: number;
}

export class MenuItemDto {
  @IsUUID()
  dishId!: string;

  @IsIn(Object.values(DishCategory), {
    message: 'El curso debe ser STARTER, MAIN, BEVERAGE o DESSERT.',
  })
  course!: DishCategory;
}

/** Full composition replacement for a DRAFT menu. */
export class ReplaceMenuItemsDto {
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  items!: MenuItemDto[];
}

export class ChangeMenuStatusDto {
  @IsIn(Object.values(MenuStatus), {
    message: 'El estado debe ser DRAFT o PUBLISHED.',
  })
  status!: MenuStatus;
}
