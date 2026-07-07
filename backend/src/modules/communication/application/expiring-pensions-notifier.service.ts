import { Injectable } from '@nestjs/common';
import { NotificationType, PensionStatus } from '@prisma/client';
import {
  addUtcDays,
  diffUtcDays,
  formatUtcDate,
  todayUtc,
} from '../../../core/dates/utc-date';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { NotificationView } from './notification-pusher.port';
import { NotificationsService } from './notifications.service';

/** How close to the end a pension is before its holder gets warned. */
export const EXPIRING_WINDOW_DAYS = 3;

/**
 * Daily "vencimientos" sweep (roadmap F9): every ACTIVE pension whose end
 * date falls within the warning window earns its client exactly one
 * PENSION_EXPIRING notification. Communication may read Pensions data —
 * the dependency direction allowed by docs/arquitectura.md §3 — so the
 * Pensions context stays unaware that notifications exist.
 *
 * Idempotence lives in the dedupe query, not in the caller: re-running the
 * sweep (crash recovery, overlapping crons) creates nothing new.
 */
@Injectable()
export class ExpiringPensionsNotifierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Returns how many notifications were created (0 on a fully-caught-up run). */
  async sweep(): Promise<number> {
    const today = todayUtc();
    const horizon = addUtcDays(today, EXPIRING_WINDOW_DAYS);

    const expiring = await this.prisma.pension.findMany({
      where: {
        status: PensionStatus.ACTIVE,
        endDate: { gte: today, lte: horizon },
      },
      select: { id: true, clientId: true, restaurantId: true, endDate: true },
    });
    if (expiring.length === 0) {
      return 0;
    }

    // Dedupe: one warning per pension, ever — read or unread. JSON-path
    // filters cannot do IN, so fetch the candidates' rows and filter here;
    // the window keeps this set small.
    const existing = await this.prisma.notification.findMany({
      where: {
        type: NotificationType.PENSION_EXPIRING,
        userId: { in: [...new Set(expiring.map((p) => p.clientId))] },
      },
      select: { payload: true },
    });
    const alreadyNotified = new Set(
      existing.map((row) => (row.payload as { pensionId?: string }).pensionId),
    );

    const pending = expiring.filter((p) => !alreadyNotified.has(p.id));
    if (pending.length === 0) {
      return 0;
    }

    const views: NotificationView[] = await this.notifications.createMany(
      pending.map((pension) => ({
        userId: pension.clientId,
        type: NotificationType.PENSION_EXPIRING,
        payload: {
          pensionId: pension.id,
          restaurantId: pension.restaurantId,
          endDate: formatUtcDate(pension.endDate),
          daysRemaining: diffUtcDays(today, pension.endDate),
        },
      })),
    );
    this.notifications.dispatch(views);
    return views.length;
  }
}
