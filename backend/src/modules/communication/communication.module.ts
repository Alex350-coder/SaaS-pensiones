import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ConversationsService } from './application/conversations.service';
import { ExpiringPensionsNotifierService } from './application/expiring-pensions-notifier.service';
import { MessagesService } from './application/messages.service';
import { NOTIFICATION_PUSHER } from './application/notification-pusher.port';
import { NotificationsService } from './application/notifications.service';
import { NoticesService } from './application/notices.service';
import { PensionExpiryNotifierJob } from './infrastructure/pension-expiry-notifier.job';
import { ChatGateway } from './presentation/chat.gateway';
import { ConversationsController } from './presentation/conversations.controller';
import {
  MyNoticesController,
  NoticesController,
} from './presentation/notices.controller';
import { NotificationsController } from './presentation/notifications.controller';
import { NotificationsGateway } from './presentation/notifications.gateway';

/**
 * Communication bounded context: chat (F8) + avisos and in-app notifications
 * (F9). Lean hexagonal: access rules are pure functions in domain/; REST
 * controllers and WS gateways are presentation adapters over the same
 * services. Notifications reach connected users through the
 * NOTIFICATION_PUSHER port, implemented by the notifications gateway.
 */
@Module({
  imports: [CoreModule, CatalogModule],
  controllers: [
    ConversationsController,
    NotificationsController,
    MyNoticesController,
    NoticesController,
  ],
  providers: [
    ConversationsService,
    MessagesService,
    NotificationsService,
    NoticesService,
    ExpiringPensionsNotifierService,
    PensionExpiryNotifierJob,
    ChatGateway,
    NotificationsGateway,
    { provide: NOTIFICATION_PUSHER, useExisting: NotificationsGateway },
  ],
})
export class CommunicationModule {}
