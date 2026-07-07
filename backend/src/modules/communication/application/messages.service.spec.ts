import { PrismaService } from '../../../core/prisma/prisma.service';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { NotificationsService } from './notifications.service';

const messageRow = (
  id: string,
  createdAt: Date,
): Record<string, unknown> => ({
  id,
  conversationId: 'conv-1',
  senderId: 'client-1',
  content: 'hola',
  readAt: null,
  createdAt,
});

interface PrismaMock {
  message: { create: jest.Mock; findMany: jest.Mock };
  conversation: { update: jest.Mock };
  $transaction: jest.Mock;
}

interface NotificationsMock {
  hasUnread: jest.Mock;
  notify: jest.Mock;
}

const buildService = (options?: {
  writable?: boolean;
  hasUnread?: boolean;
}): {
  service: MessagesService;
  prisma: PrismaMock;
  access: jest.Mock;
  notifications: NotificationsMock;
} => {
  const prisma: PrismaMock = {
    message: { create: jest.fn(), findMany: jest.fn() },
    conversation: { update: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as [])),
  };
  const access = jest.fn().mockResolvedValue({
    conversationId: 'conv-1',
    side: 'CLIENT',
    counterpartId: 'owner-1',
    writable: options?.writable ?? true,
  });
  const conversations = { getAccess: access };
  const notifications: NotificationsMock = {
    hasUnread: jest.fn().mockResolvedValue(options?.hasUnread ?? false),
    notify: jest.fn().mockResolvedValue({}),
  };
  const service = new MessagesService(
    prisma as unknown as PrismaService,
    conversations as unknown as ConversationsService,
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, access, notifications };
};

describe('MessagesService', () => {
  describe('send', () => {
    it('persists trimmed content after passing the access gate', async () => {
      const { service, prisma, access } = buildService();
      prisma.message.create.mockResolvedValue(
        messageRow('msg-1', new Date()),
      );

      await service.send('conv-1', 'client-1', '  hola  ');

      expect(access).toHaveBeenCalledWith('conv-1', 'client-1');
      expect(prisma.message.create.mock.calls[0][0].data.content).toBe('hola');
    });

    it('409s when the conversation is read-only', async () => {
      const { service, prisma } = buildService({ writable: false });

      await expect(
        service.send('conv-1', 'client-1', 'hola'),
      ).rejects.toMatchObject({ response: { code: 'CONVERSATION_READ_ONLY' } });
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('400s blank content', async () => {
      const { service } = buildService();

      await expect(
        service.send('conv-1', 'client-1', '   '),
      ).rejects.toMatchObject({ response: { code: 'INVALID_MESSAGE' } });
    });

    it('notifies the counterpart with a NEW_MESSAGE bell entry', async () => {
      const { service, prisma, notifications } = buildService();
      prisma.message.create.mockResolvedValue(messageRow('msg-1', new Date()));

      await service.send('conv-1', 'client-1', 'hola');

      expect(notifications.notify).toHaveBeenCalledWith({
        userId: 'owner-1',
        type: 'NEW_MESSAGE',
        payload: expect.objectContaining({
          conversationId: 'conv-1',
          senderId: 'client-1',
        }),
      });
    });

    it('skips the bell entry while one is already unread (dedupe)', async () => {
      const { service, prisma, notifications } = buildService({
        hasUnread: true,
      });
      prisma.message.create.mockResolvedValue(messageRow('msg-1', new Date()));

      await service.send('conv-1', 'client-1', 'hola de nuevo');

      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

  describe('list (keyset pagination)', () => {
    it('returns a nextCursor only when more rows exist', async () => {
      const { service, prisma } = buildService();
      const base = new Date('2026-07-06T10:00:00.000Z');
      const rows = [0, 1, 2].map((i) =>
        messageRow(
          `00000000-0000-0000-0000-00000000000${i}`,
          new Date(base.getTime() - i * 1000),
        ),
      );
      prisma.message.findMany.mockResolvedValue(rows);

      const page = await service.list('conv-1', 'client-1', { limit: 2 });

      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBe(
        `${page.items[1].createdAt.toISOString()}_${page.items[1].id}`,
      );
    });

    it('applies the (createdAt, id) keyset filter from the cursor', async () => {
      const { service, prisma } = buildService();
      prisma.message.findMany.mockResolvedValue([]);
      const cursor =
        '2026-07-06T10:00:00.000Z_00000000-0000-0000-0000-000000000001';

      const page = await service.list('conv-1', 'client-1', { cursor });

      expect(page.nextCursor).toBeNull();
      const where = prisma.message.findMany.mock.calls[0][0].where;
      expect(where.OR[0].createdAt.lt.toISOString()).toBe(
        '2026-07-06T10:00:00.000Z',
      );
      expect(where.OR[1].id.lt).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('400s malformed cursors', async () => {
      const { service } = buildService();

      await expect(
        service.list('conv-1', 'client-1', { cursor: 'nonsense' }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_CURSOR' } });
    });
  });
});
