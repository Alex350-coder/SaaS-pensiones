import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { AccessTokenPayload, AuthUser } from './auth-user';
import { readAccessTokenCookie } from './cookies';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Global authentication guard: every route requires a valid access token
 * unless marked @Public. A programmatic client may send a `Bearer` header
 * (takes precedence); the browser sends an httpOnly `access_token` cookie
 * (docs/security.md A2). Attaches `request.user` (AuthUser).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    // An explicit `Bearer` header wins over the cookie: browsers never send
    // one (so they always use the httpOnly cookie), while a programmatic client
    // that sets `Authorization` means it deliberately — it must not be shadowed
    // by an ambient session cookie.
    const token =
      this.extractBearerToken(request) ?? readAccessTokenCookie(request);
    if (!token) {
      throw new UnauthorizedException({
        code: 'MISSING_ACCESS_TOKEN',
        message: 'Necesitas iniciar sesión para continuar.',
      });
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.jwtAccessSecret,
        // Pinned to the only algorithm we sign with (no alg confusion).
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.',
      });
    }

    request.user = { userId: payload.sub, role: payload.role };
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' ? token : undefined;
  }
}
