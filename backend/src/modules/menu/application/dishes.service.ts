import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Dish, Prisma } from '@prisma/client';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import {
  CreateDishDto,
  ListDishesQueryDto,
  UpdateDishDto,
} from '../presentation/dto/dish.dto';

export interface DishView {
  id: string;
  name: string;
  description: string | null;
  category: Dish['category'];
  price: number;
  imageUrl: string | null;
  isActive: boolean;
}

const dishNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'DISH_NOT_FOUND',
    message: 'El plato no existe.',
  });

/** Dish catalog per restaurant. Ownership is structural (see CatalogModule). */
@Injectable()
export class DishesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurants: RestaurantsService,
  ) {}

  async list(
    ownerId: string,
    query: ListDishesQueryDto,
  ): Promise<Paginated<DishView>> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const where = {
      restaurantId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.dish.count({ where }),
      this.prisma.dish.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(rows.map((row) => this.toView(row)), total, query);
  }

  async create(ownerId: string, dto: CreateDishDto): Promise<DishView> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const dish = await this.prisma.dish.create({
      data: {
        restaurantId,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category,
        price: dto.price,
        imageUrl: dto.imageUrl ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toView(dish);
  }

  async update(
    ownerId: string,
    dishId: string,
    dto: UpdateDishDto,
  ): Promise<DishView> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const dish = await this.prisma.dish.findFirst({
      where: { id: dishId, restaurantId },
    });
    if (!dish) {
      throw dishNotFoundError();
    }
    const updated = await this.prisma.dish.update({
      where: { id: dish.id },
      data: this.toColumns(dto),
    });
    return this.toView(updated);
  }

  /**
   * Hard delete only while the dish was never used in a menu (FK RESTRICT
   * on daily_menu_items). A referenced dish must be deactivated instead —
   * history stays intact.
   */
  async remove(ownerId: string, dishId: string): Promise<void> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    try {
      const result = await this.prisma.dish.deleteMany({
        where: { id: dishId, restaurantId },
      });
      if (result.count === 0) {
        throw dishNotFoundError();
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException({
          code: 'DISH_IN_USE',
          message:
            'El plato aparece en algún menú y no puede eliminarse. Desactívalo en su lugar.',
        });
      }
      throw error;
    }
  }

  private toColumns(dto: UpdateDishDto): Prisma.DishUpdateInput {
    const entries = Object.entries({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      price: dto.price,
      imageUrl: dto.imageUrl,
      isActive: dto.isActive,
    }).filter(([, value]) => value !== undefined);
    return Object.fromEntries(entries);
  }

  private toView(row: Dish): DishView {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      price: Number(row.price),
      imageUrl: row.imageUrl,
      isActive: row.isActive,
    };
  }
}
