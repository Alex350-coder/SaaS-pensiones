import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import { NoticesService } from './notices.service';
import { NotificationsService } from './notifications.service';

const noticeRow = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id: 'notice-1',
  restaurantId: 'rest-1',
  title: 'Cierre por feriado',
  body: 'El martes no atenderemos.',
  type: 'CLOSURE',
  publishedAt: new Date('2026-07-06T09:00:00.000Z'),
  ...overrides,
});

interface PrismaMock {
  notice: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  pension: { findMany: jest.Mock };
  notification: { findFirst: jest.Mock };
  noticeRead: { upsert: jest.Mock };
  $transaction: jest.Mock;
}

interface NotificationsMock {
  createMany: jest.Mock;
  dispatch: jest.Mock;
  markReadByRef: jest.Mock;
}

const buildService = (): {
  service: NoticesService;
  prisma: PrismaMock;
  notifications: NotificationsMock;
  restaurants: { getOwnRestaurantId: jest.Mock };
} => {
  const prisma: PrismaMock = {
    notice: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    pension: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { findFirst: jest.fn() },
    noticeRead: { upsert: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };
  // Interactive transaction: run the callback against the same mock client.
  prisma.$transaction.mockImplementation(
    (arg: unknown[] | ((tx: PrismaMock) => Promise<unknown>)) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg as []),
  );
  const notifications: NotificationsMock = {
    createMany: jest.fn().mockResolvedValue([]),
    dispatch: jest.fn(),
    markReadByRef: jest.fn().mockResolvedValue(0),
  };
  const restaurants = {
    getOwnRestaurantId: jest.fn().mockResolvedValue('rest-1'),
  };
  const service = new NoticesService(
    prisma as unknown as PrismaService,
    restaurants as unknown as RestaurantsService,
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, notifications, restaurants };
};

describe('NoticesService', () => {
  describe('publish', () => {
    it('fans out only to ACTIVE pensioners of the emitting restaurant', async () => {
      const { service, prisma, notifications } = buildService();
      prisma.notice.create.mockResolvedValue(noticeRow());
      prisma.pension.findMany.mockResolvedValue([
        { clientId: 'client-1' },
        { clientId: 'client-2' },
      ]);
      notifications.createMany.mockResolvedValue([
        { id: 'n1', userId: 'client-1' },
        { id: 'n2', userId: 'client-2' },
      ]);

      const view = await service.publish('owner-1', {
        title: 'Cierre por feriado',
        body: 'El martes no atenderemos.',
        type: 'CLOSURE',
      });

      expect(view.recipientCount).toBe(2);
      // Exit criterion F9: the recipient query is scoped to this restaurant.
      expect(prisma.pension.findMany.mock.calls[0][0].where).toEqual({
        restaurantId: 'rest-1',
        status: 'ACTIVE',
      });
      const drafts = notifications.createMany.mock.calls[0][0] as {
        userId: string;
        type: string;
      }[];
      expect(drafts.map((d) => d.userId)).toEqual(['client-1', 'client-2']);
      expect(drafts.every((d) => d.type === 'NOTICE')).toBe(true);
    });

    it('dispatches over WS only after the transaction resolves', async () => {
      const { service, prisma, notifications } = buildService();
      prisma.notice.create.mockResolvedValue(noticeRow());
      prisma.pension.findMany.mockResolvedValue([{ clientId: 'client-1' }]);
      const views = [{ id: 'n1', userId: 'client-1' }];
      notifications.createMany.mockResolvedValue(views);

      await service.publish('owner-1', { title: 'Promo', body: 'Menú -10%.' });

      expect(notifications.dispatch).toHaveBeenCalledWith(views);
    });

    it('publishes with zero recipients when nobody is ACTIVE', async () => {
      const { service, prisma, notifications } = buildService();
      prisma.notice.create.mockResolvedValue(noticeRow());

      const view = await service.publish('owner-1', {
        title: 'Nuevo horario',
        body: 'Abrimos a las 11.',
      });

      expect(view.recipientCount).toBe(0);
      expect(notifications.createMany).toHaveBeenCalledWith([], prisma);
    });
  });

  describe('getForUser', () => {
    const detailRow = (): Record<string, unknown> => ({
      ...noticeRow(),
      restaurant: {
        id: 'rest-1',
        name: 'La Buena Mesa',
        slug: 'la-buena-mesa',
        ownerId: 'owner-1',
      },
      _count: { reads: 5 },
    });

    it('gives the owner the notice with read stats, without stamping', async () => {
      const { service, prisma } = buildService();
      prisma.notice.findUnique.mockResolvedValue(detailRow());

      const view = await service.getForUser('notice-1', 'owner-1');

      expect(view).toMatchObject({ id: 'notice-1', readCount: 5 });
      expect(prisma.noticeRead.upsert).not.toHaveBeenCalled();
    });

    it('stamps notice_read and clears the bell entry for a recipient', async () => {
      const { service, prisma, notifications } = buildService();
      prisma.notice.findUnique.mockResolvedValue(detailRow());
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });

      const view = await service.getForUser('notice-1', 'client-1');

      expect(view).toMatchObject({
        id: 'notice-1',
        restaurant: { slug: 'la-buena-mesa' },
      });
      expect('readCount' in view).toBe(false);
      expect(prisma.noticeRead.upsert).toHaveBeenCalledWith({
        where: {
          noticeId_userId: { noticeId: 'notice-1', userId: 'client-1' },
        },
        create: { noticeId: 'notice-1', userId: 'client-1' },
        update: {},
      });
      expect(notifications.markReadByRef).toHaveBeenCalledWith(
        'client-1',
        'NOTICE',
        'noticeId',
        'notice-1',
      );
    });

    it('404s a non-recipient without disclosing existence', async () => {
      const { service, prisma } = buildService();
      prisma.notice.findUnique.mockResolvedValue(detailRow());
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.getForUser('notice-1', 'outsider'),
      ).rejects.toMatchObject({ response: { code: 'NOTICE_NOT_FOUND' } });
      expect(prisma.noticeRead.upsert).not.toHaveBeenCalled();
    });

    it('404s a missing notice', async () => {
      const { service, prisma } = buildService();
      prisma.notice.findUnique.mockResolvedValue(null);

      await expect(
        service.getForUser('missing', 'owner-1'),
      ).rejects.toMatchObject({ response: { code: 'NOTICE_NOT_FOUND' } });
    });
  });

  describe('listMine', () => {
    it('maps read counts into the owner views', async () => {
      const { service, prisma } = buildService();
      prisma.notice.count.mockResolvedValue(1);
      prisma.notice.findMany.mockResolvedValue([
        { ...noticeRow(), _count: { reads: 3 } },
      ]);

      const page = await service.listMine('owner-1', {
        page: 1,
        limit: 20,
        skip: 0,
      });

      expect(page.items[0]).toMatchObject({ id: 'notice-1', readCount: 3 });
    });
  });
});
