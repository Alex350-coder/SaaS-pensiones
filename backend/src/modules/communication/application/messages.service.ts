import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Message } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { normalizeMessageContent } from '../domain/conversation-access';
import { ConversationsService } from './conversations.service';

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface MessagePage {
  items: MessageView[];
  /** Opaque cursor for the next (older) page; null when exhausted. */
  nextCursor: string | null;
}

export const DEFAULT_MESSAGE_PAGE_SIZE = 30;
export const MAX_MESSAGE_PAGE_SIZE = 100;

/** Cursor = "<createdAt ISO>_<id>": the DB index (created_at DESC, id DESC). */
const CURSOR_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_([0-9a-f-]{36})$/;

const invalidCursorError = (): BadRequestException =>
  new BadRequestException({
    code: 'INVALID_CURSOR',
    message: 'El cursor de paginación no es válido.',
  });

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
  ) {}

  /** Persists one message; the WS gateway broadcasts the returned view. */
  async send(
    conversationId: string,
    senderId: string,
    rawContent: string,
  ): Promise<MessageView> {
    const access = await this.conversations.getAccess(conversationId, senderId);
    if (!access.writable) {
      throw new ConflictException({
        code: 'CONVERSATION_READ_ONLY',
        message: 'La pensión ya no está vigente; el chat es de solo lectura.',
      });
    }
    const content = normalizeMessageContent(rawContent);
    if (content === null) {
      throw new BadRequestException({
        code: 'INVALID_MESSAGE',
        message: 'El mensaje no puede estar vacío ni superar 2000 caracteres.',
      });
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId, content },
      }),
      // Bumps the conversation to the top of both inboxes.
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
    return this.toView(message);
  }

  /**
   * History, newest first, keyset-paginated on (created_at, id) so pages
   * stay stable while new messages arrive (exit criterion F8).
   */
  async list(
    conversationId: string,
    userId: string,
    options: { cursor?: string; limit?: number },
  ): Promise<MessagePage> {
    await this.conversations.getAccess(conversationId, userId);
    const limit = Math.min(
      options.limit ?? DEFAULT_MESSAGE_PAGE_SIZE,
      MAX_MESSAGE_PAGE_SIZE,
    );
    const cursor = options.cursor ? this.parseCursor(options.cursor) : null;

    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const items = rows.slice(0, limit).map((row) => this.toView(row));
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? `${last.createdAt.toISOString()}_${last.id}`
          : null,
    };
  }

  private parseCursor(raw: string): { createdAt: Date; id: string } {
    const match = CURSOR_PATTERN.exec(raw);
    if (!match) {
      throw invalidCursorError();
    }
    const createdAt = new Date(match[1]);
    if (Number.isNaN(createdAt.getTime())) {
      throw invalidCursorError();
    }
    return { createdAt, id: match[2] };
  }

  private toView(message: Message): MessageView {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }
}
