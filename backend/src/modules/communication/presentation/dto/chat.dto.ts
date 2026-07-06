import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_MESSAGE_LENGTH } from '../../domain/conversation-access';
import { MAX_MESSAGE_PAGE_SIZE } from '../../application/messages.service';

export class OpenConversationDto {
  @IsUUID()
  pensionId!: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MESSAGE_LENGTH, {
    message: 'El mensaje no puede superar 2000 caracteres.',
  })
  content!: string;
}

export class MessagesQueryDto {
  /** Keyset cursor from the previous page; shape-validated by the service. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MESSAGE_PAGE_SIZE)
  limit?: number;
}
