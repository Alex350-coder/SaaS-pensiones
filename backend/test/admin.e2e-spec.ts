import { INestApplication } from '@nestjs/common';
import { accessCookie, refreshCookie } from './support';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { formatUtcDate, todayUtc } from '../src/core/dates/utc-date';
import { PrismaService } from '../src/core/prisma/prisma.service';

/**
 * Phase 10 exit criteria (integration):
 *  1. Owner dashboard metrics reconcile against the raw pension/payment/
 *     reservation/attendance rows, scoped to the caller's own restaurant.
 *  2. Every Super Admin action (user suspend/reactivate) is audited, and
 *     suspension immediately kills the account's sessions.
 * Requires the dev DB (docker compose) migrated + seeded.
 */
describe('Admin panel — dashboard & user management (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;

  const runId = Date.now();
  const password = 'Password123!';
  const price = 300;
  const today = formatUtcDate(todayUtc());

  let ownerAToken: string;
  let ownerBToken: string;
  let superToken: string;
  let superId: string;

  let client1Token: string;
  let client1Id: string;
  let client1Refresh: string;
  let client2Id: string;
  let client3Id: string;
  let dailyMenuId: string;

  interface RegisterResult {
    token: string;
    userId: string;
    refreshToken: string;
  }

  const register = async (
    email: string,
    fullName: string,
    role?: string,
  ): Promise<RegisterResult> => {
    const res = await request(http)
      .post('/api/v1/auth/register')
      .send({ email, password, fullName, ...(role ? { role } : {}) })
      .expect(201);
    return {
      token: accessCookie(res),
      userId: res.body.data.user.id,
      refreshToken: refreshCookie(res),
    };
  };

  const approveRestaurant = async (restaurantId: string): Promise<void> => {
    await request(http)
      .patch(`/api/v1/admin/restaurants/${restaurantId}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);
  };

  const createApprovedRestaurant = async (
    ownerToken: string,
    label: string,
  ): Promise<string> => {
    const created = await request(http)
      .post('/api/v1/restaurants/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `${label} ${runId}`,
        description: 'Restaurante para pruebas del panel administrativo.',
        address: 'Av. Panel 10, Lima',
        contactPhone: '+51 999 111 222',
        contactEmail: `${label}.${runId}@pensiones.dev`,
        monthlyPensionPrice: price,
      })
      .expect(201);
    await approveRestaurant(created.body.data.id);
    return created.body.data.id as string;
  };

  const contract = async (clientToken: string): Promise<string> => {
    const res = await request(http)
      .post('/api/v1/pensions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ restaurantId: restaurantAId })
      .expect(201);
    return res.body.data.id as string;
  };

  const pay = async (pensionId: string): Promise<void> => {
    await request(http)
      .post(`/api/v1/restaurants/mine/pensions/${pensionId}/payments`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ amount: price, method: 'CASH' })
      .expect(201);
  };

  const dashboard = async (
    ownerToken: string,
  ): Promise<Record<string, unknown>> => {
    const res = await request(http)
      .get('/api/v1/restaurants/mine/dashboard')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    return res.body.data as Record<string, unknown>;
  };

  let restaurantAId: string;
  let client3PensionId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);

    const superLogin = await request(http)
      .post('/api/v1/auth/login')
      .send({ email: 'superadmin@pensiones.dev', password })
      .expect(200);
    superToken = accessCookie(superLogin);
    superId = superLogin.body.data.user.id;

    ownerAToken = (
      await register(`adm.ownerA.${runId}@pensiones.dev`, 'Dueño A', 'RESTAURANT_ADMIN')
    ).token;
    ownerBToken = (
      await register(`adm.ownerB.${runId}@pensiones.dev`, 'Dueño B', 'RESTAURANT_ADMIN')
    ).token;

    restaurantAId = await createApprovedRestaurant(ownerAToken, 'PanelA');
    await createApprovedRestaurant(ownerBToken, 'PanelB');

    // Restaurant A: today's PUBLISHED menu with one dish.
    const dish = await request(http)
      .post('/api/v1/restaurants/mine/dishes')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Lomo saltado', category: 'MAIN', price: 18 })
      .expect(201);
    await request(http)
      .post('/api/v1/restaurants/mine/menus')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ menuDate: today, menuPrice: 18 })
      .expect(201);
    await request(http)
      .put(`/api/v1/restaurants/mine/menus/${today}/items`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ items: [{ dishId: dish.body.data.id, course: 'MAIN' }] })
      .expect(200);
    const published = await request(http)
      .patch(`/api/v1/restaurants/mine/menus/${today}/status`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);
    dailyMenuId = published.body.data.id;

    // client1: ACTIVE + reserves + answers WILL_ATTEND.
    const c1 = await register(`adm.c1.${runId}@pensiones.dev`, 'Cliente Uno');
    client1Token = c1.token;
    client1Id = c1.userId;
    client1Refresh = c1.refreshToken;
    const p1 = await contract(client1Token);
    await pay(p1);
    await request(http)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${client1Token}`)
      .send({ dailyMenuId, estimatedArrival: '12:30' })
      .expect(201);
    await request(http)
      .put('/api/v1/attendance')
      .set('Authorization', `Bearer ${client1Token}`)
      .send({ pensionId: p1, date: today, status: 'WILL_ATTEND' })
      .expect(200);

    // client2: ACTIVE, no reservation, no attendance answer (unanswered).
    const c2 = await register(`adm.c2.${runId}@pensiones.dev`, 'Cliente Dos');
    client2Id = c2.userId;
    await pay(await contract(c2.token));

    // client3: contracted but unpaid → PENDING_PAYMENT.
    const c3 = await register(`adm.c3.${runId}@pensiones.dev`, 'Cliente Tres');
    client3Id = c3.userId;
    client3PensionId = await contract(c3.token);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('owner dashboard metrics (exit criterion 1)', () => {
    it('rejects a client (role guard)', async () => {
      await request(http)
        .get('/api/v1/restaurants/mine/dashboard')
        .set('Authorization', `Bearer ${client1Token}`)
        .expect(403);
    });

    it('reconciles every metric against the raw data', async () => {
      const data = await dashboard(ownerAToken);
      expect(data).toEqual({
        date: today,
        activePensioners: 2,
        pendingPayments: { count: 1, amount: price },
        todayReservations: 1,
        projectedAttendance: 2, // 1 will-attend + 1 unanswered
        estimatedRevenue: price * 2,
      });
    });

    it('is scoped per-restaurant: the empty restaurant sees only zeros', async () => {
      const data = await dashboard(ownerBToken);
      expect(data).toMatchObject({
        activePensioners: 0,
        pendingPayments: { count: 0, amount: 0 },
        todayReservations: 0,
        projectedAttendance: 0,
        estimatedRevenue: 0,
      });
    });

    it('recomputes live after the pending pension is paid', async () => {
      await pay(client3PensionId);
      const data = await dashboard(ownerAToken);
      expect(data).toMatchObject({
        activePensioners: 3,
        pendingPayments: { count: 0, amount: 0 },
        projectedAttendance: 3, // 1 will-attend + 2 unanswered
        estimatedRevenue: price * 3,
      });
    });
  });

  describe('Super Admin user management (exit criterion 2)', () => {
    it('lists users and rejects non-admins', async () => {
      const res = await request(http)
        .get('/api/v1/admin/users?role=CLIENT')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(typeof res.body.data.meta.total).toBe('number');

      await request(http)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(403);
    });

    it('rejects an invalid status payload (400)', async () => {
      await request(http)
        .patch(`/api/v1/admin/users/${client2Id}/status`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'BANNED' })
        .expect(400);
    });

    it('forbids the Super Admin from suspending themselves', async () => {
      const res = await request(http)
        .patch(`/api/v1/admin/users/${superId}/status`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(403);
      expect(res.body.error.code).toBe('CANNOT_MODIFY_SELF');
    });

    it('suspends a user, writes an audit row, and kills their sessions', async () => {
      const res = await request(http)
        .patch(`/api/v1/admin/users/${client1Id}/status`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(200);
      expect(res.body.data.status).toBe('SUSPENDED');

      // Audited (exit criterion 2).
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'user.status_changed', entityId: client1Id },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorId).toBe(superId);
      expect(audit?.metadata).toMatchObject({ from: 'ACTIVE', to: 'SUSPENDED' });

      // Login is blocked and the existing refresh token no longer rotates.
      const login = await request(http)
        .post('/api/v1/auth/login')
        .send({ email: `adm.c1.${runId}@pensiones.dev`, password })
        .expect(403);
      expect(login.body.error.code).toBe('USER_SUSPENDED');

      await request(http)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${client1Refresh}`])
        .expect(401);
    });

    it('rejects re-suspending an already-suspended user (409)', async () => {
      const res = await request(http)
        .patch(`/api/v1/admin/users/${client1Id}/status`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('reactivates a user and lets them log in again', async () => {
      const res = await request(http)
        .patch(`/api/v1/admin/users/${client1Id}/status`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'ACTIVE' })
        .expect(200);
      expect(res.body.data.status).toBe('ACTIVE');

      await request(http)
        .post('/api/v1/auth/login')
        .send({ email: `adm.c1.${runId}@pensiones.dev`, password })
        .expect(200);
    });

    it('rejects reactivating an already-active user (409)', async () => {
      await request(http)
        .patch(`/api/v1/admin/users/${client3Id}/status`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'ACTIVE' })
        .expect(409);
    });
  });
});
