import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DailyMenu,
  DailyMenuItem,
  Dish,
  DishCategory,
  MenuStatus,
  Prisma,
  RestaurantStatus,
} from '@prisma/client';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import {
  CreateDailyMenuDto,
  MenuItemDto,
} from '../presentation/dto/daily-menu.dto';
import { formatMenuDate, parseMenuDate, todayMenuDate } from './menu-date';

/** Presentation order of courses on a menu. */
const COURSE_ORDER: DishCategory[] = [
  DishCategory.STARTER,
  DishCategory.MAIN,
  DishCategory.BEVERAGE,
  DishCategory.DESSERT,
];

type MenuWithItems = DailyMenu & { items: (DailyMenuItem & { dish: Dish })[] };

export interface MenuItemView {
  id: string;
  course: DishCategory;
  dish: {
    id: string;
    name: string;
    description: string | null;
    category: DishCategory;
    price: number;
    imageUrl: string | null;
  };
}

export interface OwnerMenuView {
  id: string;
  menuDate: string;
  status: MenuStatus;
  menuPrice: number;
  items: MenuItemView[];
}

const menuNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'MENU_NOT_FOUND',
    message: 'No hay menú para esa fecha.',
  });

const notEditableError = (): ConflictException =>
  new ConflictException({
    code: 'MENU_NOT_EDITABLE',
    message: 'El menú está publicado. Pásalo a borrador para editarlo.',
  });

@Injectable()
export class DailyMenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurants: RestaurantsService,
  ) {}

  // --- Owner -----------------------------------------------------------------

  async create(ownerId: string, dto: CreateDailyMenuDto): Promise<OwnerMenuView> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const menuDate = parseMenuDate(dto.menuDate);
    try {
      const menu = await this.prisma.dailyMenu.create({
        data: { restaurantId, menuDate, menuPrice: dto.menuPrice },
        include: { items: { include: { dish: true } } },
      });
      return this.toOwnerView(menu);
    } catch (error) {
      // uq(restaurant_id, menu_date) — exit criterion F5 lives in the DB.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'MENU_ALREADY_EXISTS',
          message: 'Ya existe un menú para esa fecha.',
        });
      }
      throw error;
    }
  }

  async list(
    ownerId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<OwnerMenuView>> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const where = { restaurantId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.dailyMenu.count({ where }),
      this.prisma.dailyMenu.findMany({
        where,
        include: { items: { include: { dish: true } } },
        orderBy: { menuDate: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(rows.map((row) => this.toOwnerView(row)), total, query);
  }

  async getByDate(ownerId: string, dateStr: string): Promise<OwnerMenuView> {
    const menu = await this.findOwnMenu(ownerId, dateStr);
    return this.toOwnerView(menu);
  }

  async updatePrice(
    ownerId: string,
    dateStr: string,
    menuPrice: number,
  ): Promise<OwnerMenuView> {
    const menu = await this.findOwnMenu(ownerId, dateStr);
    if (menu.status !== MenuStatus.DRAFT) {
      throw notEditableError();
    }
    const updated = await this.prisma.dailyMenu.update({
      where: { id: menu.id },
      data: { menuPrice },
      include: { items: { include: { dish: true } } },
    });
    return this.toOwnerView(updated);
  }

  /** Replaces the whole composition; DRAFT only. */
  async replaceItems(
    ownerId: string,
    dateStr: string,
    items: MenuItemDto[],
  ): Promise<OwnerMenuView> {
    const menu = await this.findOwnMenu(ownerId, dateStr);

    const dishIds = items.map((item) => item.dishId);
    if (new Set(dishIds).size !== dishIds.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_DISH',
        message: 'Un plato no puede repetirse en el mismo menú.',
      });
    }

    // Check-then-write happens under a row lock on the menu (see lockMenu):
    // a concurrent publish or replace serializes behind us instead of
    // interleaving between the status check and the item writes.
    await this.prisma.$transaction(async (tx) => {
      await this.lockMenu(tx, menu.id);

      const fresh = await tx.dailyMenu.findUnique({
        where: { id: menu.id },
        select: { status: true },
      });
      if (!fresh || fresh.status !== MenuStatus.DRAFT) {
        throw notEditableError();
      }

      // Dishes must be own, active, and served as the course they belong to
      // (invariant #2 of docs/database-design.md §4 — app-enforced).
      const dishes = await tx.dish.findMany({
        where: {
          id: { in: dishIds },
          restaurantId: menu.restaurantId,
          isActive: true,
        },
        select: { id: true, category: true },
      });
      const byId = new Map(dishes.map((dish) => [dish.id, dish]));
      for (const item of items) {
        const dish = byId.get(item.dishId);
        if (!dish) {
          throw new NotFoundException({
            code: 'DISH_NOT_FOUND',
            message: 'Algún plato no existe, no es tuyo o está inactivo.',
          });
        }
        if (dish.category !== item.course) {
          throw new BadRequestException({
            code: 'COURSE_MISMATCH',
            message:
              'Cada plato debe servirse en el curso de su categoría (p. ej., un postre no puede ir como entrada).',
          });
        }
      }

      await tx.dailyMenuItem.deleteMany({ where: { dailyMenuId: menu.id } });
      await tx.dailyMenuItem.createMany({
        data: items.map((item) => ({
          dailyMenuId: menu.id,
          dishId: item.dishId,
          course: item.course,
        })),
      });
    });

    return this.getByDate(ownerId, dateStr);
  }

  async changeStatus(
    ownerId: string,
    dateStr: string,
    target: MenuStatus,
  ): Promise<OwnerMenuView> {
    const menu = await this.findOwnMenu(ownerId, dateStr);

    // Same row lock as replaceItems: publishing cannot interleave with a
    // concurrent composition change (no PUBLISHED-and-empty menus, ever).
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockMenu(tx, menu.id);

      const fresh = await tx.dailyMenu.findUnique({
        where: { id: menu.id },
        select: { status: true },
      });
      if (!fresh) {
        throw menuNotFoundError();
      }
      if (fresh.status === target) {
        throw new ConflictException({
          code: 'INVALID_STATUS_TRANSITION',
          message: `El menú ya está en ${target}.`,
        });
      }
      if (target === MenuStatus.PUBLISHED) {
        const itemCount = await tx.dailyMenuItem.count({
          where: { dailyMenuId: menu.id },
        });
        if (itemCount === 0) {
          throw new ConflictException({
            code: 'EMPTY_MENU',
            message: 'No se puede publicar un menú sin platos.',
          });
        }
      }

      return tx.dailyMenu.update({
        where: { id: menu.id },
        data: { status: target },
        include: { items: { include: { dish: true } } },
      });
    });
    return this.toOwnerView(updated);
  }

  /** Drafts can be discarded; published menus must be unpublished first. */
  async remove(ownerId: string, dateStr: string): Promise<void> {
    const menu = await this.findOwnMenu(ownerId, dateStr);
    if (menu.status !== MenuStatus.DRAFT) {
      throw notEditableError();
    }
    await this.prisma.dailyMenu.delete({ where: { id: menu.id } });
  }

  // --- Public ------------------------------------------------------------------

  /** Menú del día: only PUBLISHED menus of APPROVED live restaurants. */
  async getPublicMenu(
    slug: string,
    dateStr?: string,
  ): Promise<Omit<OwnerMenuView, 'status' | 'id'>> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { slug, status: RestaurantStatus.APPROVED, deletedAt: null },
      select: { id: true },
    });
    if (!restaurant) {
      throw new NotFoundException({
        code: 'RESTAURANT_NOT_FOUND',
        message: 'El restaurante no existe.',
      });
    }

    const menuDate = dateStr ? parseMenuDate(dateStr) : todayMenuDate();
    const menu = await this.prisma.dailyMenu.findFirst({
      where: {
        restaurantId: restaurant.id,
        menuDate,
        status: MenuStatus.PUBLISHED,
      },
      include: { items: { include: { dish: true } } },
    });
    if (!menu) {
      throw menuNotFoundError();
    }

    const view = this.toOwnerView(menu);
    return {
      menuDate: view.menuDate,
      menuPrice: view.menuPrice,
      items: view.items,
    };
  }

  // --- Internals -----------------------------------------------------------------

  /**
   * Serializes concurrent mutations of one menu: every check-then-write path
   * (replaceItems, changeStatus) takes this lock first, so their invariants
   * (DRAFT-only edits, no empty PUBLISHED menu) hold under concurrency.
   */
  private async lockMenu(
    tx: Prisma.TransactionClient,
    menuId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM daily_menus WHERE id = ${menuId}::uuid FOR UPDATE`;
  }

  private async findOwnMenu(
    ownerId: string,
    dateStr: string,
  ): Promise<MenuWithItems> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const menu = await this.prisma.dailyMenu.findFirst({
      where: { restaurantId, menuDate: parseMenuDate(dateStr) },
      include: { items: { include: { dish: true } } },
    });
    if (!menu) {
      throw menuNotFoundError();
    }
    return menu;
  }

  private toOwnerView(menu: MenuWithItems): OwnerMenuView {
    const items = [...menu.items].sort(
      (a, b) =>
        COURSE_ORDER.indexOf(a.course) - COURSE_ORDER.indexOf(b.course) ||
        a.dish.name.localeCompare(b.dish.name),
    );
    return {
      id: menu.id,
      menuDate: formatMenuDate(menu.menuDate),
      status: menu.status,
      menuPrice: Number(menu.menuPrice),
      items: items.map((item) => ({
        id: item.id,
        course: item.course,
        dish: {
          id: item.dish.id,
          name: item.dish.name,
          description: item.dish.description,
          category: item.dish.category,
          price: Number(item.dish.price),
          imageUrl: item.dish.imageUrl,
        },
      })),
    };
  }
}
