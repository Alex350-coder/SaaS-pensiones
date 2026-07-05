import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * Phase 3 exit criteria (integration):
 *  1. register → login → refresh → logout full flow.
 *  2. Reusing a rotated refresh token revokes the whole family.
 *  3. Protected endpoints reject wrong roles with the standard envelope.
 *
 * Requires the dev DB (docker compose) migrated + seeded
 * (superadmin@pensiones.dev / Password123!).
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  // Fresh identity per run: the dev DB persists between runs.
  const email = `e2e.${Date.now()}@pensiones.dev`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('register → login → refresh → logout', () => {
    let refreshToken: string;
    let accessToken: string;

    it('registers a new CLIENT and opens a session', async () => {
      const res = await request(http)
        .post('/api/v1/auth/register')
        .send({ email, password, fullName: 'E2E Tester' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toMatchObject({ email, role: 'CLIENT' });
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(typeof res.body.data.refreshToken).toBe('string');
    });

    it('rejects a duplicate registration with EMAIL_TAKEN', async () => {
      const res = await request(http)
        .post('/api/v1/auth/register')
        .send({ email, password, fullName: 'Impostor' })
        .expect(409);

      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('rejects registering as SUPER_ADMIN', async () => {
      const res = await request(http)
        .post('/api/v1/auth/register')
        .send({
          email: `sa.${email}`,
          password,
          fullName: 'Wannabe Admin',
          role: 'SUPER_ADMIN',
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword1!' })
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('logs in and returns a session', async () => {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
      expect(res.body.data.user.email).toBe(email);
    });

    it('GET /auth/me returns the profile with the access token', async () => {
      const res = await request(http)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toMatchObject({ email, role: 'CLIENT' });
    });

    it('rotates the refresh token', async () => {
      const res = await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.refreshToken).not.toBe(refreshToken);

      // Keep the newest token for the logout step.
      refreshToken = res.body.data.refreshToken;
      accessToken = res.body.data.accessToken;
    });

    it('logs out and the refresh token stops working', async () => {
      await request(http)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      const res = await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('refresh token theft (family revocation)', () => {
    it('reusing a rotated token kills the whole family', async () => {
      const theftEmail = `theft.${Date.now()}@pensiones.dev`;
      const registered = await request(http)
        .post('/api/v1/auth/register')
        .send({ email: theftEmail, password, fullName: 'Theft Victim' })
        .expect(201);
      const stolen = registered.body.data.refreshToken;

      // Legitimate rotation: `stolen` is now consumed.
      const rotated = await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: stolen })
        .expect(200);
      const newest = rotated.body.data.refreshToken;

      // Attacker replays the consumed token → 401 + family revoked.
      await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: stolen })
        .expect(401);

      // The newest (legitimate) token is dead too: the family is gone.
      const res = await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: newest })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('RBAC (deny by default)', () => {
    it('rejects requests without a token with MISSING_ACCESS_TOKEN', async () => {
      const res = await request(http).get('/api/v1/auth/me').expect(401);

      expect(res.body).toMatchObject({
        success: false,
        data: null,
        error: { code: 'MISSING_ACCESS_TOKEN' },
      });
    });

    it('rejects a CLIENT calling a SUPER_ADMIN endpoint with FORBIDDEN', async () => {
      const login = await request(http)
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);

      const res = await request(http)
        .get('/api/v1/auth/audit-events')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .expect(403);

      expect(res.body.error).toEqual({
        code: 'FORBIDDEN',
        message: 'No tienes permisos para realizar esta acción.',
      });
    });

    it('lets the seeded SUPER_ADMIN read auth audit events', async () => {
      const login = await request(http)
        .post('/api/v1/auth/login')
        .send({ email: 'superadmin@pensiones.dev', password: 'Password123!' })
        .expect(200);

      const res = await request(http)
        .get('/api/v1/auth/audit-events')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .query({ page: 1, limit: 5 })
        .expect(200);

      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.meta).toMatchObject({ page: 1, limit: 5 });
      const actions = res.body.data.items.map(
        (item: { action: string }) => item.action,
      );
      expect(actions.some((a: string) => a.startsWith('auth.'))).toBe(true);
    });
  });
});
