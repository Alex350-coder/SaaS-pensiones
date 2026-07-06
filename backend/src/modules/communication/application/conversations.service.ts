import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PensionStatus, Prisma } from '@prisma/client';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  isWritable,
  participantSide,
  ParticipantSide,
} from '../domain/conversation-access';

export interface ConversationAccess {
  conversationId: string;
  side: ParticipantSide;
  /** The other participant's user id — the WS gateway targets them. */
  counterpartId: string;
  writable: boolean;
}

export interface ConversationView {
  id: string;
  pensionId: string;
  pensionStatus: PensionStatus;
  writable: boolean;
  restaurant: { id: string; name: string; slug: string };
  client: { id: string; fullName: string };
  lastMessage: {
    id: string;
    senderId: string;
    content: string;
    createdAt: Date;
  } | null;
  unreadCount: number;
}

interface ConversationExtras {
  lastMessage: ConversationView['lastMessage'];
  unreadCount: number;
}

const conversationNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'CONVERSATION_NOT_FOUND',
    message: 'La conversación no existe.',
  });

const conversationInclude = {
  pension: {
    select: {
      id: true,
      status: true,
      clientId: true,
      client: { select: { id: true, fullName: true } },
      restaurant: {
        select: { id: true, name: true, slug: true, ownerId: true },
      },
    },
  },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Opens (or returns) the channel of one pension. Idempotent by design:
   * UNIQUE(pension_id) in DB; a concurrent open resolves to the same row.
   * Both participants may open it, but only while the pension is live.
   */
  async open(userId: string, pensionId: string): Promise<ConversationView> {
    const pension = await this.prisma.pension.findUnique({
      where: { id: pensionId },
      select: {
        id: true,
        status: true,
        clientId: true,
        restaurant: { select: { ownerId: true } },
      },
    });
    const side = pension
      ? participantSide(
          {
            clientId: pension.clientId,
            restaurantOwnerId: pension.restaurant.ownerId,
          },
          userId,
        )
      : null;
    if (!pension || !side) {
      // Non-participants get the same 404 as a missing pension: the channel
      // (and the pension id) is not disclosed to outsiders.
      throw new NotFoundException({
        code: 'PENSION_NOT_FOUND',
        message: 'La pensión no existe.',
      });
    }

    const existing = await this.prisma.conversation.findUnique({
      where: { pensionId },
      include: conversationInclude,
    });
    if (existing) {
      return this.toView(existing, await this.fetchExtras(existing.id, userId));
    }

    if (!isWritable(pension.status)) {
      throw new ConflictException({
        code: 'CONVERSATION_READ_ONLY',
        message: 'La pensión ya no está vigente; no se puede abrir el chat.',
      });
    }

    try {
      const created = await this.prisma.conversation.create({
        data: { pensionId },
        include: conversationInclude,
      });
      // Freshly created: no messages yet by definition.
      return this.toView(created, { lastMessage: null, unreadCount: 0 });
    } catch (error) {
      // Concurrent open lost the UNIQUE(pension_id) race: return the winner.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.prisma.conversation.findUnique({
          where: { pensionId },
          include: conversationInclude,
        });
        if (winner) {
          return this.toView(winner, await this.fetchExtras(winner.id, userId));
        }
      }
      throw error;
    }
  }

  /**
   * Both sides list their channels, newest activity first. Last message and
   * unread count are batched (one DISTINCT ON + one groupBy for the whole
   * page) — per-row lookups would be an N+1 at MAX_PAGE_SIZE.
   */
  async listMine(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<ConversationView>> {
    const where: Prisma.ConversationWhereInput = {
      pension: {
        OR: [{ clientId: userId }, { restaurant: { ownerId: userId } }],
      },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        include: conversationInclude,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    const extras = await this.fetchExtrasBatch(
      rows.map((row) => row.id),
      userId,
    );
    const views = rows.map((row) =>
      this.toView(
        row,
        extras.get(row.id) ?? { lastMessage: null, unreadCount: 0 },
      ),
    );
    return paginated(views, total, query);
  }

  /**
   * Single authorization gate for REST and WS (docs/arquitectura.md §6.3):
   * resolves the caller's side of the conversation or 404s without leaking
   * that the conversation exists.
   */
  async getAccess(
    conversationId: string,
    userId: string,
  ): Promise<ConversationAccess> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        pension: {
          select: {
            status: true,
            clientId: true,
            restaurant: { select: { ownerId: true } },
          },
        },
      },
    });
    if (!conversation) {
      throw conversationNotFoundError();
    }
    const parties = {
      clientId: conversation.pension.clientId,
      restaurantOwnerId: conversation.pension.restaurant.ownerId,
    };
    const side = participantSide(parties, userId);
    if (!side) {
      throw conversationNotFoundError();
    }
    return {
      conversationId: conversation.id,
      side,
      counterpartId:
        side === 'CLIENT' ? parties.restaurantOwnerId : parties.clientId,
      writable: isWritable(conversation.pension.status),
    };
  }

  /**
   * Read indicator: stamps read_at on the counterpart's unread messages.
   * Returns how many were marked (0 is a valid no-op).
   */
  async markRead(conversationId: string, userId: string): Promise<number> {
    await this.getAccess(conversationId, userId);
    const { count } = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return count;
  }

  /** Page-sized batch: one DISTINCT ON + one groupBy, regardless of rows. */
  private async fetchExtrasBatch(
    conversationIds: string[],
    userId: string,
  ): Promise<Map<string, ConversationExtras>> {
    const extras = new Map<string, ConversationExtras>();
    if (conversationIds.length === 0) {
      return extras;
    }

    const [lastMessages, unreadGroups] = await Promise.all([
      // Rides the (conversation_id, created_at DESC, id DESC) index.
      this.prisma.$queryRaw<
        {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          created_at: Date;
        }[]
      >`
        SELECT DISTINCT ON (conversation_id)
          id, conversation_id, sender_id, content, created_at
        FROM messages
        WHERE conversation_id = ANY(${conversationIds}::uuid[])
        ORDER BY conversation_id, created_at DESC, id DESC
      `,
      this.prisma.message.groupBy({
        by: ['conversationId'],
        where: {
          conversationId: { in: conversationIds },
          senderId: { not: userId },
          readAt: null,
        },
        _count: { _all: true },
      }),
    ]);

    for (const id of conversationIds) {
      extras.set(id, { lastMessage: null, unreadCount: 0 });
    }
    for (const row of lastMessages) {
      extras.get(row.conversation_id)!.lastMessage = {
        id: row.id,
        senderId: row.sender_id,
        content: row.content,
        createdAt: row.created_at,
      };
    }
    for (const group of unreadGroups) {
      extras.get(group.conversationId)!.unreadCount = group._count._all;
    }
    return extras;
  }

  private async fetchExtras(
    conversationId: string,
    userId: string,
  ): Promise<ConversationExtras> {
    const batch = await this.fetchExtrasBatch([conversationId], userId);
    return batch.get(conversationId) ?? { lastMessage: null, unreadCount: 0 };
  }

  private toView(
    row: ConversationRow,
    { lastMessage, unreadCount }: ConversationExtras,
  ): ConversationView {
    return {
      id: row.id,
      pensionId: row.pension.id,
      pensionStatus: row.pension.status,
      writable: isWritable(row.pension.status),
      restaurant: {
        id: row.pension.restaurant.id,
        name: row.pension.restaurant.name,
        slug: row.pension.restaurant.slug,
      },
      client: row.pension.client,
      lastMessage,
      unreadCount,
    };
  }
}
