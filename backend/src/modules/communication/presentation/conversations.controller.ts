import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../core/auth/auth-user';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { ConversationsService } from '../application/conversations.service';
import { MessagesService } from '../application/messages.service';
import {
  MessagesQueryDto,
  OpenConversationDto,
  SendMessageDto,
} from './dto/chat.dto';

/**
 * REST surface of the chat: history and management. Realtime delivery is the
 * gateway's job; both call the same application services.
 */
@Roles(UserRole.CLIENT, UserRole.RESTAURANT_ADMIN)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
  ) {}

  @Post()
  open(
    @CurrentUser() user: AuthUser,
    @Body() dto: OpenConversationDto,
  ): ReturnType<ConversationsService['open']> {
    return this.conversations.open(user.userId, dto.pensionId);
  }

  @Get('mine')
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): ReturnType<ConversationsService['listMine']> {
    return this.conversations.listMine(user.userId, query);
  }

  @Get(':id/messages')
  history(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MessagesQueryDto,
  ): ReturnType<MessagesService['list']> {
    return this.messages.list(id, user.userId, query);
  }

  @Post(':id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ): ReturnType<MessagesService['send']> {
    return this.messages.send(id, user.userId, dto.content);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ updated: number }> {
    return { updated: await this.conversations.markRead(id, user.userId) };
  }
}
