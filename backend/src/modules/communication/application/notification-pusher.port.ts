import { NotificationType, Prisma } from '@prisma/client';

export const NOTIFICATION_PUSHER = Symbol('NOTIFICATION_PUSHER');

/** What a notification row looks like to every consumer (REST list, WS push). */
export interface NotificationView {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
}

/** One notification to be created; payload holds entity references only. */
export interface NotificationDraft {
  userId: string;
  type: NotificationType;
  payload: Prisma.InputJsonObject;
}

/**
 * Delivery port: the application layer creates notifications and hands them
 * here; the WS gateway (presentation) implements it by emitting to the
 * recipient's room. Keeps services free of any socket.io knowledge.
 */
export interface NotificationPusher {
  push(userId: string, notification: NotificationView): void;
}
