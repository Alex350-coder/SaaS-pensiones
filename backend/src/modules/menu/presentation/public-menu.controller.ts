import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsOptional, IsString, Matches } from 'class-validator';
import { Public } from '../../../core/auth/public.decorator';
import { DailyMenusService } from '../application/daily-menus.service';

class PublicMenuQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  date?: string;
}

/** Public "menú del día": PUBLISHED menus of APPROVED restaurants only. */
@Public()
@Controller('restaurants/:slug/menu')
export class PublicMenuController {
  constructor(private readonly menus: DailyMenusService) {}

  @Get()
  get(
    @Param('slug') slug: string,
    @Query() query: PublicMenuQueryDto,
  ): ReturnType<DailyMenusService['getPublicMenu']> {
    return this.menus.getPublicMenu(slug, query.date);
  }
}
