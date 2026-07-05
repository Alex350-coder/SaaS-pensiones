import { RestaurantStatus } from '@prisma/client';
import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ScheduleItemDto } from '../presentation/dto/update-schedules.dto';
import { RestaurantsService } from './restaurants.service';

const baseRestaurant = {
  id: 'rest-1',
  ownerId: 'owner-1',
  name: 'El Fogón',
  slug: 'el-fogon',
  description: 'Cocina casera',
  address: 'Av. Siempre Viva 123',
  contactPhone: '+51 999 888 777',
  contactEmail: 'contacto@fogon.dev',
  status: RestaurantStatus.PENDING,
  monthlyPensionPrice: 350,
  latitude: null,
  longitude: null,
  logoUrl: null,
  coverImageUrl: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

interface PrismaMock {
  restaurant: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  restaurantSchedule: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    findMany: jest.Mock;
  };
  restaurantImage: {
    count: jest.Mock;
    aggregate: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

const buildService = (): {
  service: RestaurantsService;
  prisma: PrismaMock;
  audit: { record: jest.Mock };
} => {
  const prisma: PrismaMock = {
    restaurant: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    restaurantSchedule: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    restaurantImage: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: null } }),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as [])),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new RestaurantsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { service, prisma, audit };
};

describe('RestaurantsService.changeStatus', () => {
  const cases: Array<{
    from: RestaurantStatus;
    to: RestaurantStatus;
    ok: boolean;
  }> = [
    { from: 'PENDING', to: 'APPROVED', ok: true },
    { from: 'APPROVED', to: 'SUSPENDED', ok: true },
    { from: 'SUSPENDED', to: 'APPROVED', ok: true },
    { from: 'PENDING', to: 'SUSPENDED', ok: false },
    { from: 'APPROVED', to: 'APPROVED', ok: false },
    { from: 'SUSPENDED', to: 'SUSPENDED', ok: false },
  ];

  it.each(cases)('$from -> $to allowed=$ok', async ({ from, to, ok }) => {
    const { service, prisma, audit } = buildService();
    prisma.restaurant.findFirst.mockResolvedValue({
      ...baseRestaurant,
      status: from,
    });
    prisma.restaurant.update.mockResolvedValue({
      ...baseRestaurant,
      status: to,
    });

    if (ok) {
      const result = await service.changeStatus('admin-1', 'rest-1', to);
      expect(result.status).toBe(to);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'restaurant.status_changed',
          metadata: { from, to },
        }),
      );
    } else {
      await expect(
        service.changeStatus('admin-1', 'rest-1', to),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_STATUS_TRANSITION' },
      });
      expect(prisma.restaurant.update).not.toHaveBeenCalled();
    }
  });

  it('404s on a missing restaurant', async () => {
    const { service, prisma } = buildService();
    prisma.restaurant.findFirst.mockResolvedValue(null);

    await expect(
      service.changeStatus('admin-1', 'nope', RestaurantStatus.APPROVED),
    ).rejects.toMatchObject({ response: { code: 'RESTAURANT_NOT_FOUND' } });
  });
});

describe('RestaurantsService.createOwn', () => {
  const dto = {
    name: 'El Fogón Andino',
    description: 'Cocina casera de verdad',
    address: 'Av. Los Incas 742',
    contactPhone: '+51 999 888 777',
    contactEmail: 'hola@fogon.dev',
    monthlyPensionPrice: 350,
  };

  it('creates a PENDING restaurant with a slugified name and audits it', async () => {
    const { service, prisma, audit } = buildService();
    prisma.restaurant.findFirst.mockResolvedValue(null);
    prisma.restaurant.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...baseRestaurant, ...data }),
    );

    const result = await service.createOwn('owner-1', dto);

    expect(prisma.restaurant.create.mock.calls[0][0].data.slug).toBe(
      'el-fogon-andino',
    );
    expect(result.status).toBe(RestaurantStatus.PENDING);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'restaurant.created' }),
    );
  });

  it('rejects a second live restaurant for the same owner', async () => {
    const { service, prisma } = buildService();
    prisma.restaurant.findFirst.mockResolvedValue({ id: 'rest-1' });

    await expect(service.createOwn('owner-1', dto)).rejects.toMatchObject({
      response: { code: 'RESTAURANT_ALREADY_EXISTS' },
    });
    expect(prisma.restaurant.create).not.toHaveBeenCalled();
  });

  it('retries with a suffixed slug when the live slug is taken', async () => {
    const { service, prisma } = buildService();
    prisma.restaurant.findFirst.mockResolvedValue(null);
    prisma.restaurant.create
      .mockRejectedValueOnce(
        new Error('duplicate key violates "uq_restaurants_slug_live"'),
      )
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...baseRestaurant, ...data }),
      );

    const result = await service.createOwn('owner-1', dto);

    const retriedSlug =
      prisma.restaurant.create.mock.calls[1][0].data.slug;
    expect(retriedSlug).toMatch(/^el-fogon-andino-[a-z0-9]{4}$/);
    expect(result.slug).toBe(retriedSlug);
  });
});

describe('RestaurantsService.replaceSchedules', () => {
  const item = (
    dayOfWeek: number,
    opensAt = '11:00',
    closesAt = '16:00',
  ): ScheduleItemDto => Object.assign(new ScheduleItemDto(), {
    dayOfWeek,
    opensAt,
    closesAt,
  });

  it('rejects duplicated days', async () => {
    const { service } = buildService();

    await expect(
      service.replaceSchedules('owner-1', [item(1), item(1)]),
    ).rejects.toMatchObject({ response: { code: 'DUPLICATE_SCHEDULE_DAY' } });
  });

  it('rejects opening at or after closing time', async () => {
    const { service } = buildService();

    await expect(
      service.replaceSchedules('owner-1', [item(1, '16:00', '11:00')]),
    ).rejects.toMatchObject({ response: { code: 'INVALID_SCHEDULE_RANGE' } });
  });

  it('replaces the week atomically', async () => {
    const { service, prisma } = buildService();
    prisma.restaurant.findFirst.mockResolvedValue(baseRestaurant);
    prisma.restaurantSchedule.findMany.mockResolvedValue([
      {
        dayOfWeek: 1,
        opensAt: new Date('1970-01-01T11:00:00Z'),
        closesAt: new Date('1970-01-01T16:00:00Z'),
      },
    ]);

    const result = await service.replaceSchedules('owner-1', [item(1)]);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual([
      { dayOfWeek: 1, opensAt: '11:00', closesAt: '16:00' },
    ]);
  });
});

describe('RestaurantsService gallery', () => {
  it('caps the gallery at 12 images', async () => {
    const { service, prisma } = buildService();
    prisma.restaurant.findFirst.mockResolvedValue(baseRestaurant);
    prisma.restaurantImage.count.mockResolvedValue(12);

    await expect(
      service.addImage('owner-1', 'https://cdn.dev/foto.jpg'),
    ).rejects.toMatchObject({ response: { code: 'GALLERY_FULL' } });
  });

  it('404s when deleting an image that is not in the own gallery', async () => {
    const { service, prisma } = buildService();
    prisma.restaurant.findFirst.mockResolvedValue(baseRestaurant);
    prisma.restaurantImage.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.removeImage('owner-1', '2c9a4a4e-0000-0000-0000-000000000000'),
    ).rejects.toMatchObject({ response: { code: 'IMAGE_NOT_FOUND' } });
  });
});
