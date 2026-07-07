import { NoticeType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const NOTICE_TITLE_MAX_LENGTH = 140;
export const NOTICE_BODY_MAX_LENGTH = 4000;

export class PublishNoticeDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @MaxLength(NOTICE_TITLE_MAX_LENGTH)
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'El contenido del aviso es obligatorio.' })
  @MaxLength(NOTICE_BODY_MAX_LENGTH)
  body!: string;

  @IsOptional()
  @IsEnum(NoticeType)
  type?: NoticeType;
}
