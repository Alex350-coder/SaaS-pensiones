import { MenuStatus, PensionStatus, Prisma, ReservationStatus } from '@prisma/client';
import { addUtcDays, todayUtc } from '../../../core/dates/utc-date';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import { ReservationsService } from './reservations.service';

const restaurant = { id: 'rest-1', name: 'La Buena Mesa', slug: 'la-buena-mesa' };

const menuRow = (menuDate: Date): Record<string, unknown> => ({
  id: 'menu-1',
  restaurantId: restaurant.id,
  menuDate,
  status: MenuStatus.PUBLISHED,
});

const pensionRow = (today: Date): Record<string, unknown> => ({
  id: 'pension-1',
  status: PensionStatus.ACTIVE,
  startDate: addUtcDays(today, -5),
  endDate: addUtcDays(today, 25),
});

const reservationRow = (menuDate: Date): Record<string, unknown> => ({
  id: 'res-1',
  clientId: 'client-1',
  dailyMenuId: 'menu-1',
  pensionId: 'pension-1',
  estimatedArrival: new Date('1970-01-01T12:30:00.000Z'),
  status: ReservationStatus.CONFIRMED,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  dailyMenu: { ...menuRow(menuDate), menuPrice: 15, restaurant },
});

interface TxMock {
  $queryRaw: jest.Mock;
  dailyMenu: { findFirst: jest.Mock };
  pension: { findFirst: jest.Mock };
  reservation: { create: jest.Mock };
}

interface PrismaMock {
  $transaction: jest.Mock;
  reservation: {
    count: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
}

const buildService = (): {
  service: ReservationsService;
  prisma: PrismaMock;
  tx: TxMock;
} => {
  const tx: TxMock = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    dailyMenu: { findFirst: jest.fn() },
    pension: { findFirst: jest.fn() },
    reservation: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: TxMock) => Promise<unknown>)(tx)
        : Promise.all(arg as []),
    ),
    reservation: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const restaurants = {
    getOwnRestaurantId: jest.fn().mockResolvedValue(restaurant.id),
  };
  const service = new ReservationsService(
    prisma as unknown as PrismaService,
    restaurants as unknown as RestaurantsService,
  );
  return { service, prisma, tx };
};

describe('ReservationsService', () => {
  const today = todayUtc();

  describe('create', () => {
    it('creates a reservation linked to the covering ACTIVE pension', async () => {
      const { service, tx } = buildService();
      tx.dailyMenu.findFirst.mockResolvedValue(menuRow(today));
      tx.pension.findFirst.mockResolvedValue(pensionRow(today));
      tx.reservation.create.mockResolvedValue(reservationRow(today));

      const view = await service.create('client-1', {
        dailyMenuId: 'menu-1',
        estimatedArrival: '12:30',
      });

      const data = tx.reservation.create.mock.calls[0][0].data;
      expect(data.pensionId).toBe('pension-1');
      expect(data.estimatedArrival.toISOString()).toBe(
        '1970-01-01T12:30:00.000Z',
      );
      expect(view.estimatedArrival).toBe('12:30');
      expect(view.restaurant).toEqual(restaurant);
    });

    it('404s on menus that are not published (or restaurant not approved)', async () => {
      const { service, tx } = buildService();
      tx.dailyMenu.findFirst.mockResolvedValue(null);

      await expect(
        service.create('client-1', { dailyMenuId: 'menu-1', estimatedArrival: '12:30' }),
      ).rejects.toMatchObject({ response: { code: 'MENU_NOT_FOUND' } });
      expect(tx.reservation.create).not.toHaveBeenCalled();
    });

    it('409s without an ACTIVE pension covering the menu date', async () => {
      const { service, tx } = buildService();
      tx.dailyMenu.findFirst.mockResolvedValue(menuRow(today));
      tx.pension.findFirst.mockResolvedValue(null);

      await expect(
        service.create('client-1', { dailyMenuId: 'menu-1', estimatedArrival: '12:30' }),
      ).rejects.toMatchObject({ response: { code: 'NO_ACTIVE_PENSION' } });
    });

    it('409s on past menus', async () => {
      const { service, tx } = buildService();
      tx.dailyMenu.findFirst.mockResolvedValue(menuRow(addUtcDays(today, -1)));
      tx.pension.findFirst.mockResolvedValue(pensionRow(today));

      await expect(
        service.create('client-1', { dailyMenuId: 'menu-1', estimatedArrival: '12:30' }),
      ).rejects.toMatchObject({ response: { code: 'RESERVATION_DATE_PAST' } });
    });

    it('maps the partial-unique P2002 to RESERVATION_ALREADY_EXISTS', async () => {
      const { service, tx } = buildService();
      tx.dailyMenu.findFirst.mockResolvedValue(menuRow(today));
      tx.pension.findFirst.mockResolvedValue(pensionRow(today));
      tx.reservation.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.create('client-1', { dailyMenuId: 'menu-1', estimatedArrival: '12:30' }),
      ).rejects.toMatchObject({ response: { code: 'RESERVATION_ALREADY_EXISTS' } });
    });
  });

  describe('update / cancel', () => {
    it('rejects updates to a cancelled reservation', async () => {
      const { service, prisma } = buildService();
      prisma.reservation.findFirst.mockResolvedValue({
        ...reservationRow(today),
        status: ReservationStatus.CANCELLED,
      });

      await expect(
        service.update('client-1', 'res-1', { estimatedArrival: '13:00' }),
      ).rejects.toMatchObject({
        response: { code: 'RESERVATION_NOT_MODIFIABLE' },
      });
      expect(prisma.reservation.updateMany).not.toHaveBeenCalled();
    });

    it('updates atomically by guarding CONFIRMED in the WHERE', async () => {
      const { service, prisma } = buildService();
      const row = reservationRow(today);
      prisma.reservation.findFirst.mockResolvedValue(row);
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });

      await service.update('client-1', 'res-1', { estimatedArrival: '13:00' });

      const call = prisma.reservation.updateMany.mock.calls[0][0];
      expect(call.where.status).toBe(ReservationStatus.CONFIRMED);
      expect(call.data.estimatedArrival.toISOString()).toBe(
        '1970-01-01T13:00:00.000Z',
      );
    });

    it('409s when a concurrent cancel wins the update race', async () => {
      const { service, prisma } = buildService();
      prisma.reservation.findFirst.mockResolvedValue(reservationRow(today));
      prisma.reservation.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.update('client-1', 'res-1', { notes: 'tarde' }),
      ).rejects.toMatchObject({
        response: { code: 'RESERVATION_NOT_MODIFIABLE' },
      });
    });

    it('rejects cancelling once the menu day has passed', async () => {
      const { service, prisma } = buildService();
      prisma.reservation.findFirst.mockResolvedValue(
        reservationRow(addUtcDays(today, -1)),
      );

      await expect(service.cancel('client-1', 'res-1')).rejects.toMatchObject({
        response: { code: 'RESERVATION_NOT_MODIFIABLE' },
      });
      expect(prisma.reservation.updateMany).not.toHaveBeenCalled();
    });

    it('cancels atomically by guarding CONFIRMED in the WHERE', async () => {
      const { service, prisma } = buildService();
      const row = reservationRow(today);
      prisma.reservation.findFirst
        .mockResolvedValueOnce(row)
        .mockResolvedValueOnce({ ...row, status: ReservationStatus.CANCELLED });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });

      const view = await service.cancel('client-1', 'res-1');

      expect(prisma.reservation.updateMany.mock.calls[0][0].where.status).toBe(
        ReservationStatus.CONFIRMED,
      );
      expect(view.status).toBe(ReservationStatus.CANCELLED);
    });

    it('404s reservations that belong to another client', async () => {
      const { service, prisma } = buildService();
      prisma.reservation.findFirst.mockResolvedValue(null);

      await expect(service.getMine('client-2', 'res-1')).rejects.toMatchObject({
        response: { code: 'RESERVATION_NOT_FOUND' },
      });
    });
  });
});
