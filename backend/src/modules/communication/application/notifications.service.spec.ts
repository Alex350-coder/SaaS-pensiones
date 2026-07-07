import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const notificationRow = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id: 'notif-1',
  userId: 'user-1',
  type: 'NOTICE',
  payload: { noticeId: 'notice-1' },
  readAt: null,
  createdAt: new Date('2026-07-06T12:00:00.000Z'),
  ...overrides,
});

interface PrismaMock {
  notification: {
    createManyAndReturn: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

const buildService = (): {
  service: NotificationsService;
  prisma: PrismaMock;
  pusher: { push: jest.Mock };
} => {
  const prisma: PrismaMock = {
    notification: {
      createManyAndReturn: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as [])),
  };
  const pusher: { push: jest.Mock } = { push: jest.fn() };
  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    pusher,
  );
  return { service, prisma, pusher };
};

const query = (
  overrides: Partial<PaginationQueryDto> = {},
): PaginationQueryDto => Object.assign(new PaginationQueryDto(), overrides);

describe('NotificationsService', () => {
  describe('notify', () => {
    it('creates the row and pushes it to the recipient', async () => {
      const { service, prisma, pusher } = buildService();
      prisma.notification.createManyAndReturn.mockResolvedValue([
        notificationRow(),
      ]);

      const view = await service.notify({
        userId: 'user-1',
        type: 'NOTICE',
        payload: { noticeId: 'notice-1' },
      });

      expect(view.id).toBe('notif-1');
      expect(pusher.push).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ id: 'notif-1' }),
      );
    });
  });

  describe('createMany', () => {
    it('is a no-op INSERT for zero drafts', async () => {
      const { service, prisma } = buildService();

      const views = await service.createMany([]);

      expect(views).toEqual([]);
      expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('does not push — dispatch is the producer’s post-commit step', async () => {
      const { service, prisma, pusher } = buildService();
      prisma.notification.createManyAndReturn.mockResolvedValue([
        notificationRow(),
      ]);

      await service.createMany([
        { userId: 'user-1', type: 'NOTICE', payload: {} },
      ]);

      expect(pusher.push).not.toHaveBeenCalled();
    });
  });

  describe('listMine', () => {
    it('filters to unread when asked', async () => {
      const { service, prisma } = buildService();
      prisma.notification.count.mockResolvedValue(1);
      prisma.notification.findMany.mockResolvedValue([notificationRow()]);

      const page = await service.listMine('user-1', query(), true);

      expect(page.meta.total).toBe(1);
      expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({
        userId: 'user-1',
        readAt: null,
      });
    });
  });

  describe('markRead', () => {
    it('404s a notification that belongs to someone else', async () => {
      const { service, prisma } = buildService();
      // Ownership lives in the WHERE, so the row simply is not found.
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markRead('notif-1', 'intruder')).rejects.toMatchObject(
        { response: { code: 'NOTIFICATION_NOT_FOUND' } },
      );
    });

    it('is idempotent on an already-read notification', async () => {
      const { service, prisma } = buildService();
      const readAt = new Date('2026-07-06T13:00:00.000Z');
      prisma.notification.findFirst.mockResolvedValue(
        notificationRow({ readAt }),
      );

      const view = await service.markRead('notif-1', 'user-1');

      expect(view.readAt).toEqual(readAt);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('stamps read_at on an unread notification', async () => {
      const { service, prisma } = buildService();
      prisma.notification.findFirst.mockResolvedValue(notificationRow());
      prisma.notification.update.mockResolvedValue(
        notificationRow({ readAt: new Date() }),
      );

      const view = await service.markRead('notif-1', 'user-1');

      expect(view.readAt).not.toBeNull();
    });
  });

  describe('markAllRead', () => {
    it('stamps every unread row of the user', async () => {
      const { service, prisma } = buildService();
      prisma.notification.updateMany.mockResolvedValue({ count: 4 });

      const updated = await service.markAllRead('user-1');

      expect(updated).toBe(4);
      expect(prisma.notification.updateMany.mock.calls[0][0].where).toEqual({
        userId: 'user-1',
        readAt: null,
      });
    });
  });

  describe('dedupe helpers', () => {
    it('hasUnread matches on type + payload reference', async () => {
      const { service, prisma } = buildService();
      prisma.notification.findFirst.mockResolvedValue({ id: 'notif-1' });

      const result = await service.hasUnread(
        'user-1',
        'NEW_MESSAGE',
        'conversationId',
        'conv-1',
      );

      expect(result).toBe(true);
      expect(prisma.notification.findFirst.mock.calls[0][0].where).toEqual({
        userId: 'user-1',
        type: 'NEW_MESSAGE',
        readAt: null,
        payload: { path: ['conversationId'], equals: 'conv-1' },
      });
    });

    it('markReadByRef clears only the referenced unread entries', async () => {
      const { service, prisma } = buildService();
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      const count = await service.markReadByRef(
        'user-1',
        'NOTICE',
        'noticeId',
        'notice-1',
      );

      expect(count).toBe(1);
      expect(prisma.notification.updateMany.mock.calls[0][0].where).toEqual({
        userId: 'user-1',
        type: 'NOTICE',
        readAt: null,
        payload: { path: ['noticeId'], equals: 'notice-1' },
      });
    });
  });
});
