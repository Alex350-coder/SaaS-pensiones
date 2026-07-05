import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';
import { TokenService } from './token.service';
import { LoginDto } from '../presentation/dto/login.dto';
import { RegisterDto } from '../presentation/dto/register.dto';

const activeUser = {
  id: 'user-1',
  email: 'maria@pensiones.dev',
  passwordHash: '$2b$12$storedhash',
  fullName: 'María',
  phone: null,
  role: UserRole.CLIENT,
  status: UserStatus.ACTIVE,
  deletedAt: null,
};

interface Mocks {
  prisma: {
    user: { create: jest.Mock; findFirst: jest.Mock };
    auditLog: { count: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  passwords: { hash: jest.Mock; verify: jest.Mock };
  tokens: { signAccessToken: jest.Mock };
  refreshTokens: {
    issueFamily: jest.Mock;
    rotate: jest.Mock;
    revokeFamilyOf: jest.Mock;
  };
  audit: { record: jest.Mock };
}

const buildService = (): { service: AuthService } & Mocks => {
  const mocks: Mocks = {
    prisma: {
      user: { create: jest.fn(), findFirst: jest.fn() },
      auditLog: { count: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    },
    passwords: {
      hash: jest.fn().mockResolvedValue('$2b$12$newhash'),
      verify: jest.fn().mockResolvedValue(true),
    },
    tokens: { signAccessToken: jest.fn().mockResolvedValue('access.jwt') },
    refreshTokens: {
      issueFamily: jest
        .fn()
        .mockResolvedValue({ token: 'refresh-raw', familyId: 'fam-1' }),
      rotate: jest.fn(),
      revokeFamilyOf: jest.fn().mockResolvedValue(true),
    },
    audit: { record: jest.fn().mockResolvedValue(undefined) },
  };
  const service = new AuthService(
    mocks.prisma as unknown as PrismaService,
    mocks.passwords as unknown as PasswordService,
    mocks.tokens as unknown as TokenService,
    mocks.refreshTokens as unknown as RefreshTokenService,
    mocks.audit as unknown as AuditService,
  );
  return { service, ...mocks };
};

const loginDto: LoginDto = Object.assign(new LoginDto(), {
  email: 'maria@pensiones.dev',
  password: 'Password123!',
});

describe('AuthService.login', () => {
  it('returns a session and audits auth.login on success', async () => {
    const { service, prisma, audit } = buildService();
    prisma.user.findFirst.mockResolvedValue(activeUser);

    const session = await service.login(loginDto);

    expect(session.user).toEqual({
      id: 'user-1',
      email: 'maria@pensiones.dev',
      fullName: 'María',
      role: UserRole.CLIENT,
    });
    expect(session.accessToken).toBe('access.jwt');
    expect(session.refreshToken).toBe('refresh-raw');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login' }),
    );
  });

  it('still performs a bcrypt verify when the email is unknown (timing)', async () => {
    const { service, prisma, passwords } = buildService();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.login(loginDto)).rejects.toMatchObject({
      response: { code: 'INVALID_CREDENTIALS' },
    });

    // The equalizer hash must be verified against, same cost as a real user.
    expect(passwords.verify).toHaveBeenCalledTimes(1);
    expect(passwords.verify.mock.calls[0][1]).toMatch(/^\$2b\$12\$/);
  });

  it('rejects a wrong password with the same code and audits it', async () => {
    const { service, prisma, passwords, audit } = buildService();
    prisma.user.findFirst.mockResolvedValue(activeUser);
    passwords.verify.mockResolvedValue(false);

    await expect(service.login(loginDto)).rejects.toMatchObject({
      response: { code: 'INVALID_CREDENTIALS' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login_failed',
        metadata: { reason: 'wrong_password' },
      }),
    );
  });

  it('rejects a suspended user with USER_SUSPENDED and audits it', async () => {
    const { service, prisma, audit } = buildService();
    prisma.user.findFirst.mockResolvedValue({
      ...activeUser,
      status: UserStatus.SUSPENDED,
    });

    await expect(service.login(loginDto)).rejects.toMatchObject({
      response: { code: 'USER_SUSPENDED' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login_failed',
        metadata: { reason: 'suspended' },
      }),
    );
  });
});

describe('AuthService.register', () => {
  const registerDto: RegisterDto = Object.assign(new RegisterDto(), {
    email: 'nueva@pensiones.dev',
    password: 'Password123!',
    fullName: 'Nueva Cliente',
  });

  it('defaults the role to CLIENT and audits auth.register', async () => {
    const { service, prisma, audit } = buildService();
    prisma.user.create.mockResolvedValue({
      ...activeUser,
      id: 'user-2',
      email: registerDto.email,
    });

    const session = await service.register(registerDto);

    expect(prisma.user.create.mock.calls[0][0].data.role).toBe(UserRole.CLIENT);
    expect(session.user.email).toBe(registerDto.email);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.register' }),
    );
  });

  it('never stores the plain password', async () => {
    const { service, prisma, passwords } = buildService();
    prisma.user.create.mockResolvedValue({ ...activeUser, id: 'user-2' });

    await service.register(registerDto);

    expect(passwords.hash).toHaveBeenCalledWith('Password123!');
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.passwordHash).toBe('$2b$12$newhash');
    expect(JSON.stringify(data)).not.toContain('Password123!');
  });

  it('maps a unique violation (P2002) to EMAIL_TAKEN', async () => {
    const { service, prisma } = buildService();
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.register(registerDto)).rejects.toMatchObject({
      response: { code: 'EMAIL_TAKEN' },
    });
  });

  it('maps the raw partial-unique-index violation to EMAIL_TAKEN', async () => {
    const { service, prisma } = buildService();
    prisma.user.create.mockRejectedValue(
      new Error('duplicate key value violates "uq_users_email_live"'),
    );

    await expect(service.register(registerDto)).rejects.toMatchObject({
      response: { code: 'EMAIL_TAKEN' },
    });
  });
});
