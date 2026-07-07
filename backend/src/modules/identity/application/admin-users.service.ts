import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User, UserRole, UserStatus } from '@prisma/client';
import { AuditService } from '../../../core/audit/audit.service';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';

export interface AdminUserView {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
}

export interface AdminUserFilters {
  role?: UserRole;
  status?: UserStatus;
}

const ALLOWED_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  [UserStatus.ACTIVE]: [UserStatus.SUSPENDED],
  [UserStatus.SUSPENDED]: [UserStatus.ACTIVE],
};

const userNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'USER_NOT_FOUND',
    message: 'El usuario no existe.',
  });

/**
 * Super Admin user management (roadmap F10). Suspending an account both blocks
 * new logins (the login path rejects non-ACTIVE users) and revokes every
 * refresh token, so existing sessions cannot outlive the short access-token
 * TTL. Every action is written to the append-only audit trail.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: PaginationQueryDto,
    filters: AdminUserFilters = {},
  ): Promise<Paginated<AdminUserView>> {
    const where = {
      deletedAt: null,
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(rows.map((row) => this.toView(row)), total, query);
  }

  async changeStatus(
    actorId: string,
    userId: string,
    target: UserStatus,
  ): Promise<AdminUserView> {
    // A Super Admin cannot lock themselves out (or reactivate themselves).
    if (actorId === userId) {
      throw new ForbiddenException({
        code: 'CANNOT_MODIFY_SELF',
        message: 'No puedes cambiar tu propio estado.',
      });
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw userNotFoundError();
    }

    if (!ALLOWED_TRANSITIONS[user.status].includes(target)) {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `No se puede pasar de ${user.status} a ${target}.`,
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: target },
    });

    // Suspension must not leave live sessions behind.
    const revokedSessions =
      target === UserStatus.SUSPENDED
        ? await this.refreshTokens.revokeAllForUser(user.id)
        : 0;

    await this.audit.record({
      actorId,
      action: 'user.status_changed',
      entityType: 'user',
      entityId: user.id,
      metadata: { from: user.status, to: target, revokedSessions },
    });

    return this.toView(updated);
  }

  private toView(user: User): AdminUserView {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
