import { UserRole, UserStatus } from '@prisma/client';
import { AuditService } from '../../../core/audit/audit.service';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { AdminUsersService } from './admin-users.service';
import { RefreshTokenService } from './refresh-token.service';

const userRow = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id: 'user-1',
  email: 'cliente@pensiones.dev',
  fullName: 'Cliente Uno',
  role: UserRole.CLIENT,
  status: UserStatus.ACTIVE,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

interface PrismaMock {
  user: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
}

const buildService = (): {
  service: AdminUsersService;
  prisma: PrismaMock;
  refreshTokens: { revokeAllForUser: jest.Mock };
  audit: { record: jest.Mock };
} => {
  const prisma: PrismaMock = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const refreshTokens = { revokeAllForUser: jest.fn().mockResolvedValue(2) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminUsersService(
    prisma as unknown as PrismaService,
    refreshTokens as unknown as RefreshTokenService,
    audit as unknown as AuditService,
  );
  return { service, prisma, refreshTokens, audit };
};

const query = (): PaginationQueryDto => new PaginationQueryDto();

describe('AdminUsersService', () => {
  describe('list', () => {
    it('applies role and status filters and excludes soft-deleted users', async () => {
      const { service, prisma } = buildService();
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([userRow()]);

      const page = await service.list(query(), {
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
      });

      expect(page.meta.total).toBe(1);
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
        deletedAt: null,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
      });
    });
  });

  describe('changeStatus', () => {
    it('forbids a Super Admin from changing their own status', async () => {
      const { service, prisma } = buildService();

      await expect(
        service.changeStatus('admin-1', 'admin-1', UserStatus.SUSPENDED),
      ).rejects.toMatchObject({ response: { code: 'CANNOT_MODIFY_SELF' } });
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('404s an unknown user', async () => {
      const { service, prisma } = buildService();
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.changeStatus('admin-1', 'ghost', UserStatus.SUSPENDED),
      ).rejects.toMatchObject({ response: { code: 'USER_NOT_FOUND' } });
    });

    it('rejects an illegal transition', async () => {
      const { service, prisma } = buildService();
      prisma.user.findFirst.mockResolvedValue(
        userRow({ status: UserStatus.SUSPENDED }),
      );

      await expect(
        service.changeStatus('admin-1', 'user-1', UserStatus.SUSPENDED),
      ).rejects.toMatchObject({ response: { code: 'INVALID_STATUS_TRANSITION' } });
    });

    it('suspends: revokes every session and audits with the revoked count', async () => {
      const { service, prisma, refreshTokens, audit } = buildService();
      prisma.user.findFirst.mockResolvedValue(userRow());
      prisma.user.update.mockResolvedValue(
        userRow({ status: UserStatus.SUSPENDED }),
      );

      const view = await service.changeStatus(
        'admin-1',
        'user-1',
        UserStatus.SUSPENDED,
      );

      expect(view.status).toBe(UserStatus.SUSPENDED);
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.status_changed',
          entityId: 'user-1',
          metadata: { from: 'ACTIVE', to: 'SUSPENDED', revokedSessions: 2 },
        }),
      );
    });

    it('reactivates without touching sessions', async () => {
      const { service, prisma, refreshTokens, audit } = buildService();
      prisma.user.findFirst.mockResolvedValue(
        userRow({ status: UserStatus.SUSPENDED }),
      );
      prisma.user.update.mockResolvedValue(userRow({ status: UserStatus.ACTIVE }));

      await service.changeStatus('admin-1', 'user-1', UserStatus.ACTIVE);

      expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { from: 'SUSPENDED', to: 'ACTIVE', revokedSessions: 0 },
        }),
      );
    });
  });
});
