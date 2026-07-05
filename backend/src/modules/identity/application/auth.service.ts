import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { AuditService } from '../../../core/audit/audit.service';
import { AuthUser } from '../../../core/auth/auth-user';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { LoginDto } from '../presentation/dto/login.dto';
import { RegisterDto } from '../presentation/dto/register.dto';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';
import { TokenService } from './token.service';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Same code+message whether the email exists or the password is wrong (A1). */
const invalidCredentialsError = (): UnauthorizedException =>
  new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'Correo o contraseña incorrectos.',
  });

const suspendedError = (): ForbiddenException =>
  new ForbiddenException({
    code: 'USER_SUSPENDED',
    message: 'Tu cuenta está suspendida. Contacta al soporte.',
  });

/**
 * Cost-12 hash of a fixed non-password string. Login verifies against it
 * when the email is unknown so both branches pay the same bcrypt cost —
 * response timing must not reveal whether an account exists (A1).
 */
const TIMING_EQUALIZER_HASH =
  '$2b$12$RrxPavh/CtODYEI1EB1FauZV3w6UzNzNQ51kFHxzUoxGrCYXSzXly';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSession> {
    const role = dto.role ?? UserRole.CLIENT;
    const passwordHash = await this.passwords.hash(dto.password);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone ?? null,
          role,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: 'Ya existe una cuenta con ese correo.',
        });
      }
      throw error;
    }

    await this.audit.record({
      actorId: user.id,
      action: 'auth.register',
      entityType: 'user',
      entityId: user.id,
      metadata: { role },
    });

    return this.openSession(user);
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    const passwordOk = await this.passwords.verify(
      dto.password,
      user?.passwordHash ?? TIMING_EQUALIZER_HASH,
    );

    if (!user) {
      throw invalidCredentialsError();
    }

    if (!passwordOk) {
      await this.audit.record({
        actorId: user.id,
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user.id,
        metadata: { reason: 'wrong_password' },
      });
      throw invalidCredentialsError();
    }

    if (user.status !== 'ACTIVE') {
      await this.audit.record({
        actorId: user.id,
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user.id,
        metadata: { reason: 'suspended' },
      });
      throw suspendedError();
    }

    await this.audit.record({
      actorId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
    });

    return this.openSession(user);
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const rotation = await this.refreshTokens.rotate(rawRefreshToken);
    const accessToken = await this.tokens.signAccessToken(
      rotation.user.id,
      rotation.user.role,
    );
    return { accessToken, refreshToken: rotation.token };
  }

  async logout(authUser: AuthUser, rawRefreshToken: string): Promise<void> {
    const revoked = await this.refreshTokens.revokeFamilyOf(
      rawRefreshToken,
      authUser.userId,
    );
    if (revoked) {
      await this.audit.record({
        actorId: authUser.userId,
        action: 'auth.logout',
        entityType: 'user',
        entityId: authUser.userId,
      });
    }
  }

  async me(authUser: AuthUser): Promise<PublicUser & { phone: string | null }> {
    const user = await this.prisma.user.findFirst({
      where: { id: authUser.userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'El usuario ya no existe.',
      });
    }
    return { ...this.toPublicUser(user), phone: user.phone };
  }

  /** SUPER_ADMIN: recent auth audit trail (register/login/refresh-reuse/logout). */
  async listAuthAuditEvents(
    query: PaginationQueryDto,
  ): Promise<Paginated<{ id: string; action: string; createdAt: Date }>> {
    const where = { action: { startsWith: 'auth.' } };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          actorId: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(items, total, query);
  }

  private async openSession(user: User): Promise<AuthSession> {
    const accessToken = await this.tokens.signAccessToken(user.id, user.role);
    const refresh = await this.refreshTokens.issueFamily(user.id);
    return {
      user: this.toPublicUser(user),
      accessToken,
      refreshToken: refresh.token,
    };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    // P2002 covers schema-level uniques; the live-email partial unique index
    // is raw SQL, so Postgres 23505 can also surface as an unknown error.
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2002';
    }
    return (
      error instanceof Error && error.message.includes('uq_users_email_live')
    );
  }
}
