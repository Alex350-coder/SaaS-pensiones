import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { AuthUser } from './auth-user';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

const SECRET = 'unit-test-secret-0123456789abcdef!!';

interface RequestStub {
  headers: { authorization?: string };
  user?: AuthUser;
}

const buildContext = (
  request: RequestStub,
  metadata: Record<string, unknown> = {},
): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({ metadata }),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;

const buildReflector = (metadata: Record<string, unknown>): Reflector =>
  ({
    getAllAndOverride: (key: string) => metadata[key],
  }) as unknown as Reflector;

describe('JwtAuthGuard', () => {
  const jwtService = new JwtService({ secret: SECRET });
  const config = { jwtAccessSecret: SECRET } as AppConfigService;

  const buildGuard = (metadata: Record<string, unknown> = {}): JwtAuthGuard =>
    new JwtAuthGuard(buildReflector(metadata), jwtService, config);

  it('lets @Public routes through without a token', async () => {
    const guard = buildGuard({ isPublic: true });

    await expect(
      guard.canActivate(buildContext({ headers: {} })),
    ).resolves.toBe(true);
  });

  it('rejects a missing Authorization header with MISSING_ACCESS_TOKEN', async () => {
    await expect(
      buildGuard().canActivate(buildContext({ headers: {} })),
    ).rejects.toMatchObject({
      response: { code: 'MISSING_ACCESS_TOKEN' },
    });
  });

  it('rejects a tampered token with INVALID_ACCESS_TOKEN', async () => {
    const request: RequestStub = {
      headers: { authorization: 'Bearer not-a-jwt' },
    };

    await expect(
      buildGuard().canActivate(buildContext(request)),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_ACCESS_TOKEN' },
    });
  });

  it('attaches the AuthUser for a valid token', async () => {
    const token = await jwtService.signAsync({
      sub: 'user-1',
      role: UserRole.CLIENT,
    });
    const request: RequestStub = {
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(buildGuard().canActivate(buildContext(request))).resolves.toBe(
      true,
    );
    expect(request.user).toEqual({ userId: 'user-1', role: UserRole.CLIENT });
  });
});

describe('RolesGuard', () => {
  const clientUser: AuthUser = { userId: 'u1', role: UserRole.CLIENT };

  const run = (
    metadata: Record<string, unknown>,
    user?: AuthUser,
  ): boolean => {
    const guard = new RolesGuard(buildReflector(metadata));
    return guard.canActivate(
      buildContext({ headers: {}, user }, metadata),
    );
  };

  it('lets @Public routes through', () => {
    expect(run({ isPublic: true })).toBe(true);
  });

  const captureError = (
    metadata: Record<string, unknown>,
    user?: AuthUser,
  ): unknown => {
    try {
      run(metadata, user);
      return undefined;
    } catch (error) {
      return error;
    }
  };

  it('denies a route without @Roles metadata (deny by default)', () => {
    expect(captureError({}, clientUser)).toMatchObject({
      response: { code: 'FORBIDDEN' },
    });
  });

  it('denies a role not in the allowed list', () => {
    expect(
      captureError({ roles: [UserRole.SUPER_ADMIN] }, clientUser),
    ).toMatchObject({
      response: { code: 'FORBIDDEN' },
    });
  });

  it('allows a role in the allowed list', () => {
    expect(run({ roles: [UserRole.CLIENT, UserRole.SUPER_ADMIN] }, clientUser)).toBe(
      true,
    );
  });
});
