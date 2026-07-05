import { DishCategory, MenuStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import { MenuItemDto } from '../presentation/dto/daily-menu.dto';
import { DailyMenusService } from './daily-menus.service';

const menuBase = {
  id: 'menu-1',
  restaurantId: 'rest-1',
  menuDate: new Date('2026-07-06T00:00:00.000Z'),
  status: MenuStatus.DRAFT,
  menuPrice: 25,
  items: [] as unknown[],
};

interface PrismaMock {
  dailyMenu: {
    create: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  dailyMenuItem: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    count: jest.Mock;
  };
  dish: { findMany: jest.Mock };
  restaurant: { findFirst: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
}

const buildService = (): { service: DailyMenusService; prisma: PrismaMock } => {
  const prisma = {
    dailyMenu: {
      create: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    dailyMenuItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    dish: { findMany: jest.fn() },
    restaurant: { findFirst: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  } as unknown as PrismaMock;
  // Interactive transactions receive the same mock as the tx client;
  // array form keeps the Promise.all behavior.
  prisma.$transaction = jest.fn((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: PrismaMock) => Promise<unknown>)(prisma)
      : Promise.all(arg as Promise<unknown>[]),
  );
  const restaurants = {
    getOwnRestaurantId: jest.fn().mockResolvedValue('rest-1'),
  };
  const service = new DailyMenusService(
    prisma as unknown as PrismaService,
    restaurants as unknown as RestaurantsService,
  );
  return { service, prisma };
};

const item = (dishId: string, course: DishCategory): MenuItemDto =>
  Object.assign(new MenuItemDto(), { dishId, course });

describe('DailyMenusService.replaceItems', () => {
  it('rejects edits on a PUBLISHED menu (checked under the row lock)', async () => {
    const { service, prisma } = buildService();
    prisma.dailyMenu.findFirst.mockResolvedValue({
      ...menuBase,
      status: MenuStatus.PUBLISHED,
    });
    prisma.dailyMenu.findUnique.mockResolvedValue({
      status: MenuStatus.PUBLISHED,
    });

    await expect(
      service.replaceItems('owner-1', '2026-07-06', []),
    ).rejects.toMatchObject({ response: { code: 'MENU_NOT_EDITABLE' } });
    expect(prisma.$queryRaw).toHaveBeenCalled(); // FOR UPDATE lock taken
    expect(prisma.dailyMenuItem.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects duplicated dishes before touching the DB', async () => {
    const { service, prisma } = buildService();
    prisma.dailyMenu.findFirst.mockResolvedValue({ ...menuBase });

    await expect(
      service.replaceItems('owner-1', '2026-07-06', [
        item('dish-1', DishCategory.MAIN),
        item('dish-1', DishCategory.MAIN),
      ]),
    ).rejects.toMatchObject({ response: { code: 'DUPLICATE_DISH' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a dish that is missing, foreign or inactive', async () => {
    const { service, prisma } = buildService();
    prisma.dailyMenu.findFirst.mockResolvedValue({ ...menuBase });
    prisma.dailyMenu.findUnique.mockResolvedValue({ status: MenuStatus.DRAFT });
    prisma.dish.findMany.mockResolvedValue([]);

    await expect(
      service.replaceItems('owner-1', '2026-07-06', [
        item('dish-x', DishCategory.MAIN),
      ]),
    ).rejects.toMatchObject({ response: { code: 'DISH_NOT_FOUND' } });
  });

  it('rejects serving a dish outside its category (invariant #2)', async () => {
    const { service, prisma } = buildService();
    prisma.dailyMenu.findFirst.mockResolvedValue({ ...menuBase });
    prisma.dailyMenu.findUnique.mockResolvedValue({ status: MenuStatus.DRAFT });
    prisma.dish.findMany.mockResolvedValue([
      { id: 'dish-1', category: DishCategory.DESSERT },
    ]);

    await expect(
      service.replaceItems('owner-1', '2026-07-06', [
        item('dish-1', DishCategory.STARTER),
      ]),
    ).rejects.toMatchObject({ response: { code: 'COURSE_MISMATCH' } });
  });

  it('replaces the composition inside the locked transaction', async () => {
    const { service, prisma } = buildService();
    prisma.dailyMenu.findFirst.mockResolvedValue({ ...menuBase });
    prisma.dailyMenu.findUnique.mockResolvedValue({ status: MenuStatus.DRAFT });
    prisma.dish.findMany.mockResolvedValue([
      { id: 'dish-1', category: DishCategory.MAIN },
    ]);

    await service.replaceItems('owner-1', '2026-07-06', [
      item('dish-1', DishCategory.MAIN),
    ]);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.dailyMenuItem.createMany).toHaveBeenCalledWith({
      data: [
        { dailyMenuId: 'menu-1', dishId: 'dish-1', course: DishCategory.MAIN },
      ],
    });
  });
});

describe('DailyMenusService.changeStatus', () => {
  it('refuses to publish an empty menu (count checked under the lock)', async () => {
    const { service, prisma } = buildService();
    prisma.dailyMenu.findFirst.mockResolvedValue({ ...menuBase });
    prisma.dailyMenu.findUnique.mockResolvedValue({ status: MenuStatus.DRAFT });
    prisma.dailyMenuItem.count.mockResolvedValue(0);

    await expect(
      service.changeStatus('owner-1', '2026-07-06', MenuStatus.PUBLISHED),
    ).rejects.toMatchObject({ response: { code: 'EMPTY_MENU' } });
    expect(prisma.dailyMenu.update).not.toHaveBeenCalled();
  });

  it('publishes a menu that has items', async () => {
    const { service, prisma } = buildService();
    prisma.dailyMenu.findFirst.mockResolvedValue({ ...menuBase });
    prisma.dailyMenu.findUnique.mockResolvedValue({ status: MenuStatus.DRAFT });
    prisma.dailyMenuItem.count.mockResolvedValue(2);
    prisma.dailyMenu.update.mockResolvedValue({
      ...menuBase,
      status: MenuStatus.PUBLISHED,
    });

    const result = await service.changeStatus(
      'owner-1',
      '2026-07-06',
      MenuStatus.PUBLISHED,
    );
    expect(result.status).toBe(MenuStatus.PUBLISHED);
  });

  it('rejects a no-op transition', async () => {
    const { service, prisma } = buildService();
    prisma.dailyMenu.findFirst.mockResolvedValue({ ...menuBase });
    prisma.dailyMenu.findUnique.mockResolvedValue({ status: MenuStatus.DRAFT });

    await expect(
      service.changeStatus('owner-1', '2026-07-06', MenuStatus.DRAFT),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_STATUS_TRANSITION' },
    });
  });
});

describe('DailyMenusService.getPublicMenu', () => {
  it('404s when the restaurant is not APPROVED', async () => {
    const { service, prisma } = buildService();
    prisma.restaurant.findFirst.mockResolvedValue(null);

    await expect(
      service.getPublicMenu('fonda-oculta', '2026-07-06'),
    ).rejects.toMatchObject({ response: { code: 'RESTAURANT_NOT_FOUND' } });
  });

  it('404s when the menu exists but is DRAFT (never leaks drafts)', async () => {
    const { service, prisma } = buildService();
    prisma.restaurant.findFirst.mockResolvedValue({ id: 'rest-1' });
    // The PUBLISHED filter is part of the query itself: a draft yields null.
    prisma.dailyMenu.findFirst.mockResolvedValue(null);

    await expect(
      service.getPublicMenu('fonda', '2026-07-06'),
    ).rejects.toMatchObject({ response: { code: 'MENU_NOT_FOUND' } });
    expect(
      prisma.dailyMenu.findFirst.mock.calls[0][0].where.status,
    ).toBe(MenuStatus.PUBLISHED);
  });
});
