import { PrismaService } from '../../../core/prisma/prisma.service';
import { todayUtc, addUtcDays, formatUtcDate } from '../../../core/dates/utc-date';
import { ExpiringPensionsNotifierService } from './expiring-pensions-notifier.service';
import { NotificationsService } from './notifications.service';

interface PrismaMock {
  pension: { findMany: jest.Mock };
  notification: { findMany: jest.Mock };
}

const buildService = (): {
  service: ExpiringPensionsNotifierService;
  prisma: PrismaMock;
  notifications: { createMany: jest.Mock; dispatch: jest.Mock };
} => {
  const prisma: PrismaMock = {
    pension: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const notifications = {
    createMany: jest.fn().mockResolvedValue([]),
    dispatch: jest.fn(),
  };
  const service = new ExpiringPensionsNotifierService(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, notifications };
};

const expiringPension = (
  id: string,
  clientId: string,
  inDays: number,
): Record<string, unknown> => ({
  id,
  clientId,
  restaurantId: 'rest-1',
  endDate: addUtcDays(todayUtc(), inDays),
});

describe('ExpiringPensionsNotifierService', () => {
  it('does nothing when no ACTIVE pension is inside the window', async () => {
    const { service, notifications } = buildService();

    const created = await service.sweep();

    expect(created).toBe(0);
    expect(notifications.createMany).not.toHaveBeenCalled();
  });

  it('warns each expiring pension holder once, with date references', async () => {
    const { service, prisma, notifications } = buildService();
    prisma.pension.findMany.mockResolvedValue([
      expiringPension('pension-1', 'client-1', 2),
    ]);
    notifications.createMany.mockResolvedValue([
      { id: 'n1', userId: 'client-1' },
    ]);

    const created = await service.sweep();

    expect(created).toBe(1);
    const drafts = notifications.createMany.mock.calls[0][0] as {
      payload: Record<string, unknown>;
    }[];
    expect(drafts[0].payload).toEqual({
      pensionId: 'pension-1',
      restaurantId: 'rest-1',
      endDate: formatUtcDate(addUtcDays(todayUtc(), 2)),
      daysRemaining: 2,
    });
    expect(notifications.dispatch).toHaveBeenCalled();
  });

  it('is idempotent: already-notified pensions are skipped', async () => {
    const { service, prisma, notifications } = buildService();
    prisma.pension.findMany.mockResolvedValue([
      expiringPension('pension-1', 'client-1', 1),
      expiringPension('pension-2', 'client-2', 3),
    ]);
    // pension-1 was warned on a previous run (read or unread — either counts).
    prisma.notification.findMany.mockResolvedValue([
      { payload: { pensionId: 'pension-1' } },
    ]);
    notifications.createMany.mockResolvedValue([
      { id: 'n2', userId: 'client-2' },
    ]);

    const created = await service.sweep();

    expect(created).toBe(1);
    const drafts = notifications.createMany.mock.calls[0][0] as {
      payload: { pensionId: string };
    }[];
    expect(drafts).toHaveLength(1);
    expect(drafts[0].payload.pensionId).toBe('pension-2');
  });

  it('creates nothing when every candidate was already warned', async () => {
    const { service, prisma, notifications } = buildService();
    prisma.pension.findMany.mockResolvedValue([
      expiringPension('pension-1', 'client-1', 1),
    ]);
    prisma.notification.findMany.mockResolvedValue([
      { payload: { pensionId: 'pension-1' } },
    ]);

    const created = await service.sweep();

    expect(created).toBe(0);
    expect(notifications.createMany).not.toHaveBeenCalled();
  });
});
