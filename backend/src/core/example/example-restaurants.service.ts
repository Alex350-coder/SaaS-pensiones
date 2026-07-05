import { Injectable } from '@nestjs/common';
import { Paginated, paginated } from '../http/pagination/paginated';
import { PaginationQueryDto } from '../http/pagination/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';

export interface ExampleRestaurantItem {
  id: string;
  name: string;
  slug: string;
  address: string;
}

/**
 * TEMPORARY (Phase 2 exit criterion): proves envelope + pagination + Prisma
 * adapter end to end over seeded data. Replaced by the real public catalog
 * in Phase 4 — delete this whole `example/` directory then.
 */
@Injectable()
export class ExampleRestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findApproved(
    query: PaginationQueryDto,
  ): Promise<Paginated<ExampleRestaurantItem>> {
    const where = { status: 'APPROVED' as const, deletedAt: null };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.restaurant.count({ where }),
      this.prisma.restaurant.findMany({
        where,
        select: { id: true, name: true, slug: true, address: true },
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);

    return paginated(items, total, query);
  }
}
