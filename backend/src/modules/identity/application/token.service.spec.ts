import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const jwtService = new JwtService({
    secret: 'unit-test-secret-0123456789abcdef!!',
    signOptions: { expiresIn: 900 },
  });
  const service = new TokenService(jwtService);

  it('signs a payload containing ONLY sub and role (no personal data)', async () => {
    const token = await service.signAccessToken('user-1', UserRole.CLIENT);
    const payload = jwtService.decode<Record<string, unknown>>(token);

    // Regression guard against payload creep (docs/security.md §4).
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'role', 'sub']);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe(UserRole.CLIENT);
  });

  it('sets the configured expiry (15 minutes)', async () => {
    const token = await service.signAccessToken('user-1', UserRole.CLIENT);
    const payload = jwtService.decode<{ iat: number; exp: number }>(token);

    expect(payload.exp - payload.iat).toBe(900);
  });
});
