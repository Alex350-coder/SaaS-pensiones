import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ConversationsService } from './conversations.service';

const pensionSelect = {
  id: 'pension-1',
  status: 'ACTIVE',
  clientId: 'client-1',
  restaurant: { ownerId: 'owner-1' },
};

const conversationRow = (): Record<string, unknown> => ({
  id: 'conv-1',
  pensionId: 'pension-1',
  pension: {
    id: 'pension-1',
    status: 'ACTIVE',
    clientId: 'client-1',
    client: { id: 'client-1', fullName: 'Cliente Uno' },
    restaurant: {
      id: 'rest-1',
      name: 'La Buena Mesa',
      slug: 'la-buena-mesa',
      ownerId: 'owner-1',
    },
  },
});

interface PrismaMock {
  pension: { findUnique: jest.Mock };
  conversation: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
  };
  message: {
    findFirst: jest.Mock;
    count: jest.Mock;
    updateMany: jest.Mock;
    groupBy: jest.Mock;
  };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
}

const buildService = (): {
  service: ConversationsService;
  prisma: PrismaMock;
} => {
  const prisma: PrismaMock = {
    pension: { findUnique: jest.fn() },
    conversation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    message: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as [])),
  };
  const service = new ConversationsService(prisma as unknown as PrismaService);
  return { service, prisma };
};

describe('ConversationsService', () => {
  describe('open', () => {
    it('creates the channel for a live pension participant', async () => {
      const { service, prisma } = buildService();
      prisma.pension.findUnique.mockResolvedValue(pensionSelect);
      prisma.conversation.findUnique.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue(conversationRow());

      const view = await service.open('client-1', 'pension-1');

      expect(view.id).toBe('conv-1');
      expect(view.writable).toBe(true);
    });

    it('404s non-participants without revealing the pension', async () => {
      const { service, prisma } = buildService();
      prisma.pension.findUnique.mockResolvedValue(pensionSelect);

      await expect(
        service.open('intruder', 'pension-1'),
      ).rejects.toMatchObject({ response: { code: 'PENSION_NOT_FOUND' } });
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('409s opening a new channel on a dead pension, but returns an existing one', async () => {
      const { service, prisma } = buildService();
      prisma.pension.findUnique.mockResolvedValue({
        ...pensionSelect,
        status: 'EXPIRED',
      });
      prisma.conversation.findUnique.mockResolvedValue(null);
      await expect(
        service.open('client-1', 'pension-1'),
      ).rejects.toMatchObject({ response: { code: 'CONVERSATION_READ_ONLY' } });

      // History survives expiration: an existing channel is still returned.
      const existing = conversationRow();
      (existing.pension as { status: string }).status = 'EXPIRED';
      prisma.conversation.findUnique.mockResolvedValue(existing);
      const view = await service.open('client-1', 'pension-1');
      expect(view.writable).toBe(false);
    });

    it('resolves the UNIQUE(pension_id) race to the winning row', async () => {
      const { service, prisma } = buildService();
      prisma.pension.findUnique.mockResolvedValue(pensionSelect);
      prisma.conversation.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(conversationRow());
      prisma.conversation.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const view = await service.open('client-1', 'pension-1');
      expect(view.id).toBe('conv-1');
    });
  });

  describe('getAccess', () => {
    const accessRow = {
      id: 'conv-1',
      pension: {
        status: 'ACTIVE',
        clientId: 'client-1',
        restaurant: { ownerId: 'owner-1' },
      },
    };

    it('resolves each side and its counterpart', async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(accessRow);

      const client = await service.getAccess('conv-1', 'client-1');
      expect(client).toMatchObject({ side: 'CLIENT', counterpartId: 'owner-1' });

      const owner = await service.getAccess('conv-1', 'owner-1');
      expect(owner).toMatchObject({
        side: 'RESTAURANT',
        counterpartId: 'client-1',
      });
    });

    it('404s foreign users with the same error as a missing conversation', async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(accessRow);

      await expect(
        service.getAccess('conv-1', 'intruder'),
      ).rejects.toMatchObject({ response: { code: 'CONVERSATION_NOT_FOUND' } });
    });
  });

  describe('listMine', () => {
    it('batches last messages and unread counts for the whole page', async () => {
      const { service, prisma } = buildService();
      const rowA = { ...conversationRow(), id: 'conv-a' };
      const rowB = { ...conversationRow(), id: 'conv-b' };
      prisma.conversation.count.mockResolvedValue(2);
      prisma.conversation.findMany.mockResolvedValue([rowA, rowB]);
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'msg-9',
          conversation_id: 'conv-a',
          sender_id: 'owner-1',
          content: 'último',
          created_at: new Date(),
        },
      ]);
      prisma.message.groupBy.mockResolvedValue([
        { conversationId: 'conv-a', _count: { _all: 4 } },
      ]);

      const page = await service.listMine('client-1', {
        page: 1,
        limit: 20,
        skip: 0,
      });

      // One raw batch + one groupBy — never one query pair per conversation.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.message.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.message.findFirst).not.toHaveBeenCalled();

      const [viewA, viewB] = page.items;
      expect(viewA.lastMessage?.content).toBe('último');
      expect(viewA.unreadCount).toBe(4);
      expect(viewB.lastMessage).toBeNull();
      expect(viewB.unreadCount).toBe(0);
    });
  });

  describe('markRead', () => {
    it("stamps read_at only on the counterpart's unread messages", async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        pension: {
          status: 'ACTIVE',
          clientId: 'client-1',
          restaurant: { ownerId: 'owner-1' },
        },
      });
      prisma.message.updateMany.mockResolvedValue({ count: 3 });

      const updated = await service.markRead('conv-1', 'client-1');

      expect(updated).toBe(3);
      expect(prisma.message.updateMany.mock.calls[0][0].where).toMatchObject({
        conversationId: 'conv-1',
        senderId: { not: 'client-1' },
        readAt: null,
      });
    });
  });
});
