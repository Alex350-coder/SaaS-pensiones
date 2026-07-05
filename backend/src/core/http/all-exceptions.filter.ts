import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { apiError, ApiErrorResponse } from './api-envelope';

const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

// User-facing messages are Spanish; codes stay English (project rule).
const MESSAGE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'La solicitud no es válida.',
  [HttpStatus.UNAUTHORIZED]: 'Necesitas iniciar sesión para continuar.',
  [HttpStatus.FORBIDDEN]: 'No tienes permisos para realizar esta acción.',
  [HttpStatus.NOT_FOUND]: 'El recurso solicitado no existe.',
  [HttpStatus.CONFLICT]: 'La operación entra en conflicto con el estado actual.',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'No se pudo procesar la solicitud.',
  [HttpStatus.TOO_MANY_REQUESTS]:
    'Demasiadas solicitudes. Intenta de nuevo en unos minutos.',
  [HttpStatus.INTERNAL_SERVER_ERROR]:
    'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
  [HttpStatus.SERVICE_UNAVAILABLE]:
    'El servicio no está disponible en este momento.',
};

interface HttpExceptionBody {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

/**
 * Global safety net: every error leaves the API as the standard envelope.
 * Exceptions thrown with `{ code, message }` pass through untouched (that is
 * how domain errors reach the client); everything else falls back to a
 * status-derived code with a generic Spanish message.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = this.buildErrorBody(exception, status);

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${body.error.code}`,
        stack,
      );
    }

    response.status(status).json(body);
  }

  private buildErrorBody(exception: unknown, status: number): ApiErrorResponse {
    const fallbackCode = CODE_BY_STATUS[status] ?? 'INTERNAL_ERROR';
    const fallbackMessage =
      MESSAGE_BY_STATUS[status] ??
      MESSAGE_BY_STATUS[HttpStatus.INTERNAL_SERVER_ERROR];

    if (!(exception instanceof HttpException)) {
      return apiError(fallbackCode, fallbackMessage);
    }

    const raw = exception.getResponse();

    if (typeof raw === 'object' && raw !== null) {
      const { code, message, details } = raw as HttpExceptionBody;

      // ValidationPipe rejections arrive as `message: string[]`.
      if (Array.isArray(message)) {
        return apiError(
          'VALIDATION_ERROR',
          'Los datos enviados no son válidos.',
          message,
        );
      }

      // Deliberate `{ code, message }` errors pass through as-is.
      if (typeof code === 'string' && typeof message === 'string') {
        return apiError(code, message, details);
      }
    }

    // Framework default (English) message: expose it only outside production.
    const originalMessage =
      typeof raw === 'string'
        ? raw
        : (raw as HttpExceptionBody).message?.toString();
    const details =
      !this.config.isProduction && originalMessage
        ? { originalMessage }
        : undefined;

    return apiError(fallbackCode, fallbackMessage, details);
  }
}
