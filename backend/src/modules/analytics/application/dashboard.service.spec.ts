import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import { ProjectionService } from '../../reservations/application/projection.service';
import { DashboardService } from './dashboard.service';

interface PrismaMock {
  payment: { aggregate: jest.Mock };
  pension: { aggregate: jest.Mock };
  $transaction: jest.Mock;
}

const projectionView = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  date: '2026-07-07',
  reservations: { confirmed: 4 },
  attendance: { willAttend: 6, willNotAttend: 2 },
  pensioners: { active: 10, unanswered: 2 },
  projectedAttendance: 8,
  ...overrides,
});

const buildService = (): {
  service: DashboardService;
  prisma: PrismaMock;
  restaurants: { getOwnRestaurantId: jest.Mock };
  projection: { getForDay: jest.Mock };
} => {
  const prisma: PrismaMock = {
    payment: { aggregate: jest.fn() },
    pension: { aggregate: jest.fn() },
    // Metrics service passes an array of prepared queries; resolve them all.
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const restaurants = { getOwnRestaurantId: jest.fn().mockResolvedValue('rest-1') };
  const projection = { getForDay: jest.fn().mockResolvedValue(projectionView()) };
  const service = new DashboardService(
    prisma as unknown as PrismaService,
    restaurants as unknown as RestaurantsService,
    projection as unknown as ProjectionService,
  );
  return { service, prisma, restaurants, projection };
};

describe('DashboardService', () => {
  it('composes projection figures with the outstanding-balance and revenue aggregates', async () => {
    const { service, prisma, projection } = buildService();
    // pension.aggregate is called twice: [0] awaiting-payment, [1] active revenue.
    prisma.pension.aggregate
      .mockResolvedValueOnce({ _count: 3, _sum: { price: '900.00' } })
      .mockResolvedValueOnce({ _sum: { price: '3000.00' } });
    // A partial payment already collected against the awaiting pensions.
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: '100.00' } });

    const metrics = await service.getForOwner('owner-1');

    expect(projection.getForDay).toHaveBeenCalledWith('owner-1');
    expect(metrics).toEqual({
      date: '2026-07-07',
      activePensioners: 10,
      pendingPayments: { count: 3, amount: 800 },
      todayReservations: 4,
      projectedAttendance: 8,
      estimatedRevenue: 3000,
    });
  });

  it('scopes the aggregates to the caller’s own restaurant', async () => {
    const { service, prisma, restaurants } = buildService();
    prisma.pension.aggregate.mockResolvedValue({ _count: 0, _sum: { price: null } });
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });

    await service.getForOwner('owner-1');

    expect(restaurants.getOwnRestaurantId).toHaveBeenCalledWith('owner-1');
    expect(prisma.pension.aggregate.mock.calls[0][0].where).toEqual({
      restaurantId: 'rest-1',
      status: 'PENDING_PAYMENT',
    });
    expect(prisma.payment.aggregate.mock.calls[0][0].where).toEqual({
      status: 'CONFIRMED',
      pension: { restaurantId: 'rest-1', status: 'PENDING_PAYMENT' },
    });
    expect(prisma.pension.aggregate.mock.calls[1][0].where).toEqual({
      restaurantId: 'rest-1',
      status: 'ACTIVE',
    });
  });

  it('treats null aggregate sums as zero money', async () => {
    const { service, prisma } = buildService();
    prisma.pension.aggregate.mockResolvedValue({ _count: 0, _sum: { price: null } });
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });

    const metrics = await service.getForOwner('owner-1');

    expect(metrics.pendingPayments).toEqual({ count: 0, amount: 0 });
    expect(metrics.estimatedRevenue).toBe(0);
  });
});
