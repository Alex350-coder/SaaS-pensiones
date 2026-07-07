import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RefreshToken, User } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { AppConfigService } from '../../../core/config/app-config.service';
import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface IssuedRefreshToken {
  /** Raw token for the client. Only its SHA-256 hash is stored. */
  token: string;
  familyId: string;
}

export interface RotationResult {
  token: string;
  familyId: string;
  user: User;
}

const invalidTokenError = (): UnauthorizedException =>
  new UnauthorizedException({
    code: 'INVALID_REFRESH_TOKEN',
    message: 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.',
  });

/**
 * Opaque refresh tokens with per-device families (docs/security.md A2):
 * every use rotates the token inside its family; presenting an
 * already-rotated token is treated as theft and revokes the whole family.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  /** Starts a new family (login/register = new device session). */
  async issueFamily(userId: string): Promise<IssuedRefreshToken> {
    return this.createToken(userId, randomUUID());
  }

  /**
   * Rotates a presented token. Reuse of a rotated/revoked token or any
   * unknown token fails with 401; reuse additionally revokes the family.
   */
  async rotate(rawToken: string): Promise<RotationResult> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
      include: { user: true },
    });

    if (!stored) {
      throw invalidTokenError();
    }

    if (stored.revokedAt) {
      await this.detectReuse(stored);
    }

    if (stored.expiresAt <= new Date()) {
      throw invalidTokenError();
    }

    if (stored.user.deletedAt || stored.user.status !== 'ACTIVE') {
      await this.revokeFamily(stored.familyId);
      throw invalidTokenError();
    }

    // Atomic claim: under a concurrent double-refresh only one request
    // rotates; the loser sees revokedAt already set and lands in reuse.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.detectReuse(stored);
    }

    const next = await this.createToken(stored.userId, stored.familyId);
    return { ...next, user: stored.user };
  }

  /** Logout: kills the device session the presented token belongs to. */
  async revokeFamilyOf(rawToken: string, userId: string): Promise<boolean> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!stored || stored.userId !== userId) {
      return false;
    }
    await this.revokeFamily(stored.familyId);
    return true;
  }

  /**
   * Kills every device session of a user (all families). Used when an admin
   * suspends the account so no stale refresh token can renew access after the
   * short-lived access token expires.
   */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  private async detectReuse(stored: RefreshToken): Promise<never> {
    const revokedCount = await this.revokeFamily(stored.familyId);
    // Only the request that actually revoked live tokens audits the event,
    // so concurrent replays of one stolen token produce a single alert.
    if (revokedCount > 0) {
      await this.audit.record({
        actorId: stored.userId,
        action: 'auth.refresh_reuse_detected',
        entityType: 'user',
        entityId: stored.userId,
        metadata: { familyId: stored.familyId },
      });
    }
    throw invalidTokenError();
  }

  private async revokeFamily(familyId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  private async createToken(
    userId: string,
    familyId: string,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: this.hash(token),
        expiresAt: new Date(
          Date.now() + this.config.refreshTokenTtlDays * MS_PER_DAY,
        ),
      },
    });
    return { token, familyId };
  }

  private hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
