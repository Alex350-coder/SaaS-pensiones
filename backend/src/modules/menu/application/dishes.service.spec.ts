import { DishCategory, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import { UpdateDishDto } from '../presentation/dto/dish.dto';
import { DishesService } from './dishes.service';

const dishRow = {
  id: 'dish-1',
  restaurantId: 'rest-1',
  name: 'Lomo saltado',
  description: null,
  category: DishCategory.MAIN,
  price: 18.5,
  imageUrl: null,
  isActive: true,
};

interface PrismaMock {
  dish: {
    count: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

const buildService = (): { service: DishesService; prisma: PrismaMock } => {
  const prisma: PrismaMock = {
    dish: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as [])),
  };
  const restaurants = {
    getOwnRestaurantId: jest.fn().mockResolvedValue('rest-1'),
  };
  const service = new DishesService(
    prisma as unknown as PrismaService,
    restaurants as unknown as RestaurantsService,
  );
  return { service, prisma };
};

describe('DishesService', () => {
  it('creates a dish scoped to the own restaurant with defaults', async () => {
    const { service, prisma } = buildService();
    prisma.dish.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...dishRow, ...data }),
    );

    const result = await service.create('owner-1', {
      name: 'Lomo saltado',
      category: DishCategory.MAIN,
      price: 18.5,
    });

    const data = prisma.dish.create.mock.calls[0][0].data;
    expect(data.restaurantId).toBe('rest-1');
    expect(data.isActive).toBe(true);
    expect(result.price).toBe(18.5);
  });

  it('404s when updating a dish that is not own', async () => {
    const { service, prisma } = buildService();
    prisma.dish.findFirst.mockResolvedValue(null);

    await expect(
      service.update('owner-1', 'foreign-dish', { price: 1 }),
    ).rejects.toMatchObject({ response: { code: 'DISH_NOT_FOUND' } });
    expect(prisma.dish.update).not.toHaveBeenCalled();
  });

  it('maps FK RESTRICT (P2003) on delete to DISH_IN_USE', async () => {
    const { service, prisma } = buildService();
    prisma.dish.deleteMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('restricted', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );

    await expect(service.remove('owner-1', 'dish-1')).rejects.toMatchObject({
      response: { code: 'DISH_IN_USE' },
    });
  });

  it('404s when deleting a dish that is not own', async () => {
    const { service, prisma } = buildService();
    prisma.dish.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('owner-1', 'dish-x')).rejects.toMatchObject({
      response: { code: 'DISH_NOT_FOUND' },
    });
  });
});

describe('UpdateDishDto validation', () => {
  const buildDto = (plain: Record<string, unknown>): UpdateDishDto =>
    plainToInstance(UpdateDishDto, plain);

  it('accepts a partial update', async () => {
    expect(await validate(buildDto({ price: 12.5 }))).toHaveLength(0);
  });

  it('rejects explicit null on isActive (NOT NULL column)', async () => {
    const errors = await validate(buildDto({ isActive: null }));

    expect(errors.map((e) => e.property)).toContain('isActive');
  });

  it('rejects explicit null on required-at-create fields like name', async () => {
    const errors = await validate(buildDto({ name: null }));

    expect(errors.map((e) => e.property)).toContain('name');
  });

  it('accepts null on nullable columns (clears description/imageUrl)', async () => {
    expect(await validate(buildDto({ description: null }))).toHaveLength(0);
  });
});
