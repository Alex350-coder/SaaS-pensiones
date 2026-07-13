import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { readCsrfCookie, readCsrfHeader } from './cookies';
import { IS_PUBLIC_KEY } from './public.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF guard (docs/security.md A8). Because auth now travels in
 * cookies, a state-changing request carries the session ambiently and is
 * CSRF-eligible. For mutating methods we require an `X-CSRF-Token` header that
 * matches the readable `csrf_token` cookie — a value a cross-site attacker
 * cannot read (SameSite) nor set on our header.
 *
 * Skipped for safe methods and for requests that authenticate via a `Bearer`
 * header (non-ambient: a programmatic/mobile client is not CSRF-exposed).
 * Registered after the auth guards so it only guards authenticated flows.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    // @Public routes (login/register/refresh) carry no ambient authenticated
    // session; the refresh cookie is SameSite=Strict, so cross-site cannot
    // send it. Nothing to protect with double-submit here.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Bearer auth is not ambient — no CSRF risk, no token required.
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return true;
    }

    const cookie = readCsrfCookie(request);
    const header = readCsrfHeader(request);
    if (!cookie || !header || !safeEqual(cookie, header)) {
      throw new ForbiddenException({
        code: 'CSRF_TOKEN_INVALID',
        message: 'Solicitud no válida. Recarga la página e inténtalo de nuevo.',
      });
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
