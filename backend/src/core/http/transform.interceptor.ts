import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { ApiResponse, apiSuccess, isApiResponse } from './api-envelope';

/** Wraps every successful controller result in the standard envelope. */
@Injectable()
export class TransformInterceptor
  implements NestInterceptor<unknown, ApiResponse<unknown>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<ApiResponse<unknown>> {
    return next
      .handle()
      .pipe(map((data) => (isApiResponse(data) ? data : apiSuccess(data ?? null))));
  }
}
