import { UserStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { AppConfigService } from '../../../core/config/app-config.service';
import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';

const FUTURE = new Date(Date.now() + 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);

const activeUser = {
  id: 'user-1',
  status: UserStatus.ACTIVE,
  deletedAt: null,
  role: 'CLIENT',
};

interface PrismaMock {
  refreshToken: {
    findUnique: jest.Mock;
    updateMany: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
  };
}

const buildService = (): {
  service: RefreshTokenService;
  prisma: PrismaMock;
  audit: { record: jest.Mock };
} => {
  const prisma: PrismaMock = {
    refreshToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const config = { refreshTokenTtlDays: 7 } as AppConfigService;
  const service = new RefreshTokenService(
    prisma as unknown as PrismaService,
    config,
    audit as unknown as AuditService,
  );
  return { service, prisma, audit };
};

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

describe('RefreshTokenService', () => {
  it('issueFamily stores only a hash of the raw token', async () => {
    const { service, prisma } = buildService();

    const issued = await service.issueFamily('user-1');

    const createArg = prisma.refreshToken.create.mock.calls[0][0].data;
    expect(createArg.tokenHash).toBe(sha256(issued.token));
    expect(createArg.tokenHash).not.toBe(issued.token);
    expect(createArg.familyId).toBe(issued.familyId);
  });

  it('rotate revokes the used token and issues a new one in the same family', async () => {
    const { service, prisma } = buildService();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: FUTURE,
      user: activeUser,
    });

    const result = await service.rotate('raw-token');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'tok-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.familyId).toBe('fam-1');
    expect(result.user.id).toBe('user-1');
  });

  it('rejects an unknown token', async () => {
    const { service, prisma } = buildService();
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    await expect(service.rotate('nope')).rejects.toMatchObject({
      response: { code: 'INVALID_REFRESH_TOKEN' },
    });
  });

  it('reuse of a rotated token revokes the whole family and audits it', async () => {
    const { service, prisma, audit } = buildService();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      familyId: 'fam-1',
      revokedAt: new Date(),
      expiresAt: FUTURE,
      user: activeUser,
    });

    await expect(service.rotate('stolen')).rejects.toMatchObject({
      response: { code: 'INVALID_REFRESH_TOKEN' },
    });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'fam-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh_reuse_detected' }),
    );
  });

  it('rejects an expired token without rotating', async () => {
    const { service, prisma } = buildService();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: PAST,
      user: activeUser,
    });

    await expect(service.rotate('old')).rejects.toMatchObject({
      response: { code: 'INVALID_REFRESH_TOKEN' },
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('treats a lost concurrent claim as reuse', async () => {
    const { service, prisma, audit } = buildService();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: FUTURE,
      user: activeUser,
    });
    // First updateMany call (the atomic claim) loses the race.
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.rotate('raced')).rejects.toMatchObject({
      response: { code: 'INVALID_REFRESH_TOKEN' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh_reuse_detected' }),
    );
  });

  it('does not audit reuse again when the family was already fully revoked', async () => {
    const { service, prisma, audit } = buildService();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      familyId: 'fam-1',
      revokedAt: new Date(),
      expiresAt: FUTURE,
      user: activeUser,
    });
    // Family revocation touches no live rows: someone already revoked it.
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.rotate('replayed-again')).rejects.toMatchObject({
      response: { code: 'INVALID_REFRESH_TOKEN' },
    });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('revokeFamilyOf ignores tokens belonging to another user', async () => {
    const { service, prisma } = buildService();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'tok-1',
      userId: 'someone-else',
      familyId: 'fam-1',
    });

    await expect(service.revokeFamilyOf('raw', 'user-1')).resolves.toBe(false);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('purgeExpired deletes tokens past expiry and returns the count', async () => {
    const { service, prisma } = buildService();
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 4 });
    const now = new Date('2026-07-12T00:00:00.000Z');

    await expect(service.purgeExpired(now)).resolves.toBe(4);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: now } },
    });
  });
});
