import { Injectable } from '@nestjs/common';
import { SessionTerminator } from '../../identity/application/ports/session-terminator.port';
import { ChatGateway } from '../presentation/chat.gateway';
import { NotificationsGateway } from '../presentation/notifications.gateway';

/**
 * Adapter for Identity's SESSION_TERMINATOR port: drops a user's live sockets
 * across every realtime namespace (chat + notifications) when they log out or
 * are suspended. Communication owns the gateways, so the arrow points
 * Communication → Identity (same inversion as Billing → Pensions).
 */
@Injectable()
export class CommunicationSessionTerminator implements SessionTerminator {
  constructor(
    private readonly chat: ChatGateway,
    private readonly notifications: NotificationsGateway,
  ) {}

  disconnectUser(userId: string): void {
    this.chat.disconnectUser(userId);
    this.notifications.disconnectUser(userId);
  }
}
