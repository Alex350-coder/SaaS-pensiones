import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import {
  NOTIFICATION_PUSHER,
  NotificationDraft,
  NotificationPusher,
  NotificationView,
} from './notification-pusher.port';

const notificationNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'NOTIFICATION_NOT_FOUND',
    message: 'La notificación no existe.',
  });

/**
 * Per-user in-app notifications (the bell). Producers (notices, chat, the
 * expiry sweep) create rows through here; delivery to connected users goes
 * through the NotificationPusher port so this service never touches sockets.
 *
 * create* and dispatch are split on purpose: producers that write inside a
 * transaction must only dispatch after it commits, so a rollback can never
 * have announced a row that does not exist.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PUSHER) private readonly pusher: NotificationPusher,
  ) {}

  /** Convenience for producers outside a transaction: create + dispatch. */
  async notify(draft: NotificationDraft): Promise<NotificationView> {
    const [view] = await this.createMany([draft]);
    this.dispatch([view]);
    return view;
  }

  /**
   * Single INSERT for any number of drafts (notice fan-out is one statement).
   * Accepts a transaction client so producers can create notifications
   * atomically with their own writes. Does NOT dispatch — see class docs.
   */
  async createMany(
    drafts: NotificationDraft[],
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<NotificationView[]> {
    if (drafts.length === 0) {
      return [];
    }
    const rows = await client.notification.createManyAndReturn({
      data: drafts,
    });
    return rows.map((row) => this.toView(row));
  }

  /** Pushes to each recipient's WS room; no-op for disconnected users. */
  dispatch(views: NotificationView[]): void {
    for (const view of views) {
      this.pusher.push(view.userId, view);
    }
  }

  async listMine(
    userId: string,
    query: PaginationQueryDto,
    unread = false,
  ): Promise<Paginated<NotificationView>> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unread ? { readAt: null } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(
      rows.map((row) => this.toView(row)),
      total,
      query,
    );
  }

  /** Bell badge; rides the partial unread index. */
  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  /** Idempotent: re-reading an already-read notification changes nothing. */
  async markRead(id: string, userId: string): Promise<NotificationView> {
    const row = await this.prisma.notification.findFirst({
      // Ownership in the WHERE: another user's id gets the same 404 as a
      // missing one, so ids are not probeable.
      where: { id, userId },
    });
    if (!row) {
      throw notificationNotFoundError();
    }
    if (row.readAt) {
      return this.toView(row);
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toView(updated);
  }

  async markAllRead(userId: string): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return count;
  }

  /**
   * Dedupe guard for producers: true when the user already has an unread
   * notification of this type referencing the same entity (e.g. one
   * NEW_MESSAGE per conversation keeps the bell meaningful instead of one
   * row per message).
   */
  async hasUnread(
    userId: string,
    type: NotificationType,
    refKey: string,
    refValue: string,
  ): Promise<boolean> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        userId,
        type,
        readAt: null,
        payload: { path: [refKey], equals: refValue },
      },
      select: { id: true },
    });
    return existing !== null;
  }

  /**
   * Cross-feature consistency: when the referenced entity is read at its
   * source (conversation opened, notice viewed), its bell entry clears too.
   */
  async markReadByRef(
    userId: string,
    type: NotificationType,
    refKey: string,
    refValue: string,
  ): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: {
        userId,
        type,
        readAt: null,
        payload: { path: [refKey], equals: refValue },
      },
      data: { readAt: new Date() },
    });
    return count;
  }

  private toView(row: Notification): NotificationView {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      payload: row.payload,
      readAt: row.readAt,
      createdAt: row.createdAt,
    };
  }
}
