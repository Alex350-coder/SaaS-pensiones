import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { ConversationsService } from './application/conversations.service';
import { MessagesService } from './application/messages.service';
import { ChatGateway } from './presentation/chat.gateway';
import { ConversationsController } from './presentation/conversations.controller';

/**
 * Communication bounded context (chat; avisos/notificaciones arrive in F9).
 * Lean hexagonal: access rules are pure functions in domain/; REST controller
 * and WS gateway are two presentation adapters over the same services.
 */
@Module({
  imports: [CoreModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, MessagesService, ChatGateway],
})
export class CommunicationModule {}
