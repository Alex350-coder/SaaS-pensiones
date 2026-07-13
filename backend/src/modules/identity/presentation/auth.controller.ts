import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthUser } from '../../../core/auth/auth-user';
import {
  clearAuthCookies,
  readRefreshTokenCookie,
  setAuthCookies,
} from '../../../core/auth/cookies';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { Public } from '../../../core/auth/public.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { AppConfigService } from '../../../core/config/app-config.service';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import {
  AuthService,
  AuthSession,
  PublicUser,
} from '../application/auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const MINUTE_MS = 60_000;

/** HTTP body after auth: the user only — tokens live in httpOnly cookies. */
type SessionResponse = { user: PublicUser };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: MINUTE_MS } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    return this.issueSession(await this.authService.register(dto), res);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTE_MS } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    return this.issueSession(await this.authService.login(dto), res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: MINUTE_MS } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    const rawRefreshToken = readRefreshTokenCookie(req);
    if (!rawRefreshToken) {
      throw new UnauthorizedException({
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Tu sesión expiró. Inicia sesión de nuevo.',
      });
    }
    const tokens = await this.authService.refresh(rawRefreshToken);
    setAuthCookies(res, this.config, tokens);
    return null;
  }

  @Roles(UserRole.CLIENT, UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    // Always invoke logout (even without a refresh cookie) so live sockets are
    // severed; token-family revocation happens only when a token is present.
    await this.authService.logout(user, readRefreshTokenCookie(req));
    clearAuthCookies(res, this.config);
    return null;
  }

  @Roles(UserRole.CLIENT, UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  @Get('me')
  me(@CurrentUser() user: AuthUser): ReturnType<AuthService['me']> {
    return this.authService.me(user);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('audit-events')
  listAuditEvents(
    @Query() query: PaginationQueryDto,
  ): ReturnType<AuthService['listAuthAuditEvents']> {
    return this.authService.listAuthAuditEvents(query);
  }

  /** Set the auth cookies and strip the tokens from the HTTP body. */
  private issueSession(
    session: AuthSession,
    res: Response,
  ): SessionResponse {
    setAuthCookies(res, this.config, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    return { user: session.user };
  }
}
