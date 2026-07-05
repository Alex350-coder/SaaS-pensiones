import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../core/auth/current-user.decorator';
import { AuthUser } from '../../../core/auth/auth-user';
import { Public } from '../../../core/auth/public.decorator';
import { Roles } from '../../../core/auth/roles.decorator';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import {
  AuthService,
  AuthSession,
  TokenPair,
} from '../application/auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

const MINUTE_MS = 60_000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: MINUTE_MS } })
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthSession> {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTE_MS } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthSession> {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: MINUTE_MS } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Roles(UserRole.CLIENT, UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthUser,
    @Body() dto: RefreshTokenDto,
  ): Promise<null> {
    await this.authService.logout(user, dto.refreshToken);
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
}
