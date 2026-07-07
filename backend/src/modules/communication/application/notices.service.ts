import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NoticeType,
  NotificationType,
  PensionStatus,
  Prisma,
} from '@prisma/client';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import { NotificationsService } from './notifications.service';

export interface NoticeView {
  id: string;
  restaurantId: string;
  title: string;
  body: string;
  type: NoticeType;
  publishedAt: Date;
}

/** Owner surface adds delivery/read stats the client has no business seeing. */
export interface OwnerNoticeView extends NoticeView {
  readCount: number;
}

export interface ClientNoticeView extends NoticeView {
  restaurant: { id: string; name: string; slug: string };
}

export interface PublishNoticeInput {
  title: string;
  body: string;
  type?: NoticeType;
}

const noticeNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'NOTICE_NOT_FOUND',
    message: 'El aviso no existe.',
  });

/**
 * Avisos restaurante → pensionarios (roadmap F9). Recipients are the clients
 * with an ACTIVE pension at the moment of publishing, materialized as NOTICE
 * notifications in the same transaction as the notice
 * (docs/database-design.md §3.6) — later contracts do not receive older
 * avisos, and suspending the restaurant does not retract delivered ones.
 */
@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurants: RestaurantsService,
    private readonly notifications: NotificationsService,
  ) {}

  async publish(
    ownerUserId: string,
    input: PublishNoticeInput,
  ): Promise<OwnerNoticeView & { recipientCount: number }> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerUserId);

    const { notice, views } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.notice.create({
        data: {
          restaurantId,
          title: input.title.trim(),
          body: input.body.trim(),
          type: input.type ?? NoticeType.GENERAL,
        },
      });
      // Exit criterion F9: the fan-out is scoped to THIS restaurant's ACTIVE
      // pensioners; distinct guards against data ever allowing two live rows.
      const recipients = await tx.pension.findMany({
        where: { restaurantId, status: PensionStatus.ACTIVE },
        select: { clientId: true },
        distinct: ['clientId'],
      });
      const fanout = await this.notifications.createMany(
        recipients.map(({ clientId }) => ({
          userId: clientId,
          type: NotificationType.NOTICE,
          payload: {
            noticeId: created.id,
            restaurantId,
            noticeType: created.type,
            title: created.title,
          },
        })),
        tx,
      );
      return { notice: created, views: fanout };
    });

    // Only after commit: a rollback must never have been announced over WS.
    this.notifications.dispatch(views);

    return { ...this.toView(notice), readCount: 0, recipientCount: views.length };
  }

  /** The restaurant's own history, newest first, with read stats. */
  async listMine(
    ownerUserId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<OwnerNoticeView>> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerUserId);
    const where: Prisma.NoticeWhereInput = { restaurantId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notice.count({ where }),
      this.prisma.notice.findMany({
        where,
        include: { _count: { select: { reads: true } } },
        orderBy: { publishedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(
      rows.map((row) => ({ ...this.toView(row), readCount: row._count.reads })),
      total,
      query,
    );
  }

  /**
   * Notice detail. The owner sees read stats; a recipient (someone the
   * publish fan-out materialized a notification for) gets the notice and is
   * stamped as having read it — in notice_reads for the restaurant's stats
   * and on their bell entry for the unread counter. Anyone else gets the
   * same 404 as a missing notice: existence is not disclosed.
   */
  async getForUser(
    noticeId: string,
    userId: string,
  ): Promise<OwnerNoticeView | ClientNoticeView> {
    const notice = await this.prisma.notice.findUnique({
      where: { id: noticeId },
      include: {
        restaurant: { select: { id: true, name: true, slug: true, ownerId: true } },
        _count: { select: { reads: true } },
      },
    });
    if (!notice) {
      throw noticeNotFoundError();
    }

    if (notice.restaurant.ownerId === userId) {
      return { ...this.toView(notice), readCount: notice._count.reads };
    }

    const received = await this.prisma.notification.findFirst({
      where: {
        userId,
        type: NotificationType.NOTICE,
        payload: { path: ['noticeId'], equals: noticeId },
      },
      select: { id: true },
    });
    if (!received) {
      throw noticeNotFoundError();
    }

    // Reading is idempotent: first visit stamps, later visits are no-ops.
    await this.prisma.noticeRead.upsert({
      where: { noticeId_userId: { noticeId, userId } },
      create: { noticeId, userId },
      update: {},
    });
    await this.notifications.markReadByRef(
      userId,
      NotificationType.NOTICE,
      'noticeId',
      noticeId,
    );

    return {
      ...this.toView(notice),
      restaurant: {
        id: notice.restaurant.id,
        name: notice.restaurant.name,
        slug: notice.restaurant.slug,
      },
    };
  }

  private toView(row: {
    id: string;
    restaurantId: string;
    title: string;
    body: string;
    type: NoticeType;
    publishedAt: Date;
  }): NoticeView {
    return {
      id: row.id,
      restaurantId: row.restaurantId,
      title: row.title,
      body: row.body,
      type: row.type,
      publishedAt: row.publishedAt,
    };
  }
}
