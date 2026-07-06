import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { addUtcDays, parseUtcDate } from '../src/core/dates/utc-date';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { ExpirePensionsUseCase } from '../src/modules/pensions/application/use-cases/expire-pensions.usecase';

/**
 * Phase 6 exit criteria (integration):
 *  1. No two live pensions per client+restaurant — enforced by the DB
 *     partial unique, not application logic.
 *  2. daysRemaining/expiration are UTC-consistent (expiration exercised by
 *     backdating a pension and running the expiration use case).
 * Requires the dev DB (docker compose) migrated + seeded.
 */
describe('Pensions (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let expirePensions: ExpirePensionsUseCase;

  const runId = Date.now();
  const password = 'Password123!';
  const price = 300;
  let ownerToken: string;
  let clientToken: string;
  let restaurantId: string;
  let pensionId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    expirePensions = app.get(ExpirePensionsUseCase);

    // Fresh owner with an APPROVED restaurant.
    const owner = await request(http)
      .post('/api/v1/auth/register')
      .send({
        email: `pension.owner.${runId}@pensiones.dev`,
        password,
        fullName: 'Dueño Pensiones',
        role: 'RESTAURANT_ADMIN',
      })
      .expect(201);
    ownerToken = owner.body.data.accessToken;

    const created = await request(http)
      .post('/api/v1/restaurants/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Pensiones E2E ${runId}`,
        description: 'Restaurante para pruebas del sistema de pensiones.',
        address: 'Av. Pensión 30, Lima',
        contactPhone: '+51 999 777 666',
        contactEmail: `pension.${runId}@pensiones.dev`,
        monthlyPensionPrice: price,
      })
      .expect(201);
    restaurantId = created.body.data.id;

    const superAdmin = await request(http)
      .post('/api/v1/auth/login')
      .send({ email: 'superadmin@pensiones.dev', password })
      .expect(200);
    await request(http)
      .patch(`/api/v1/admin/restaurants/${restaurantId}/status`)
      .set('Authorization', `Bearer ${superAdmin.body.data.accessToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    const client = await request(http)
      .post('/api/v1/auth/register')
      .send({
        email: `pension.client.${runId}@pensiones.dev`,
        password,
        fullName: 'Cliente Pensiones',
      })
      .expect(201);
    clientToken = client.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('contracting', () => {
    it('a client contracts a pension (PENDING_PAYMENT, price snapshot, 30 days)', async () => {
      const res = await request(http)
        .post('/api/v1/pensions')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ restaurantId })
        .expect(201);

      expect(res.body.data).toMatchObject({
        status: 'PENDING_PAYMENT',
        price,
        daysRemaining: 30,
      });
      pensionId = res.body.data.id;
    });

    it('a second live pension in the same restaurant is rejected by the DB', async () => {
      const res = await request(http)
        .post('/api/v1/pensions')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ restaurantId })
        .expect(409);
      expect(res.body.error.code).toBe('PENSION_ALREADY_EXISTS');
    });

    it('a RESTAURANT_ADMIN cannot contract pensions', async () => {
      await request(http)
        .post('/api/v1/pensions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ restaurantId })
        .expect(403);
    });
  });

  describe('payments and activation', () => {
    it('a partial payment accumulates without activating', async () => {
      const res = await request(http)
        .post(`/api/v1/restaurants/mine/pensions/${pensionId}/payments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ amount: 100, method: 'CASH' })
        .expect(201);

      expect(res.body.data.activated).toBe(false);
      expect(res.body.data.paidTotal).toBe(100);
      expect(res.body.data.pension.status).toBe('PENDING_PAYMENT');
    });

    it('a payment exceeding the balance is rejected', async () => {
      const res = await request(http)
        .post(`/api/v1/restaurants/mine/pensions/${pensionId}/payments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ amount: 250, method: 'CASH' })
        .expect(400);
      expect(res.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
    });

    it('completing the price activates: start=today, end=+30, 30 days left', async () => {
      const res = await request(http)
        .post(`/api/v1/restaurants/mine/pensions/${pensionId}/payments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ amount: 200, method: 'TRANSFER' })
        .expect(201);

      const { pension, activated, paidTotal } = res.body.data;
      expect(activated).toBe(true);
      expect(paidTotal).toBe(price);
      expect(pension.status).toBe('ACTIVE');
      expect(pension.daysRemaining).toBe(30);

      const start = parseUtcDate(pension.startDate);
      const end = parseUtcDate(pension.endDate);
      expect(addUtcDays(start, 30).getTime()).toBe(end.getTime());
    });

    it('no more payments once ACTIVE', async () => {
      const res = await request(http)
        .post(`/api/v1/restaurants/mine/pensions/${pensionId}/payments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ amount: 10, method: 'CASH' })
        .expect(409);
      expect(res.body.error.code).toBe('PENSION_NOT_PAYABLE');
    });

    it('the client sees payments and paid total in their detail', async () => {
      const res = await request(http)
        .get(`/api/v1/pensions/mine/${pensionId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(res.body.data.paidTotal).toBe(price);
      expect(res.body.data.payments).toHaveLength(2);
    });
  });

  describe('lifecycle rules', () => {
    it('a client cannot cancel an ACTIVE pension', async () => {
      const res = await request(http)
        .post(`/api/v1/pensions/mine/${pensionId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('the restaurant suspends and reactivates without touching dates', async () => {
      const before = await request(http)
        .get(`/api/v1/restaurants/mine/pensions/${pensionId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const suspended = await request(http)
        .patch(`/api/v1/restaurants/mine/pensions/${pensionId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(200);
      expect(suspended.body.data.status).toBe('SUSPENDED');

      const reactivated = await request(http)
        .patch(`/api/v1/restaurants/mine/pensions/${pensionId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'ACTIVE' })
        .expect(200);
      expect(reactivated.body.data.status).toBe('ACTIVE');
      expect(reactivated.body.data.endDate).toBe(before.body.data.endDate);
    });

    it('the expiring view includes it with a wide window, not the default', async () => {
      const wide = await request(http)
        .get('/api/v1/restaurants/mine/pensions/expiring')
        .set('Authorization', `Bearer ${ownerToken}`)
        .query({ days: 31 })
        .expect(200);
      expect(
        wide.body.data.items.map((p: { id: string }) => p.id),
      ).toContain(pensionId);

      const narrow = await request(http)
        .get('/api/v1/restaurants/mine/pensions/expiring')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(
        narrow.body.data.items.map((p: { id: string }) => p.id),
      ).not.toContain(pensionId);
    });
  });

  describe('cross-tenant isolation', () => {
    let strangerClientToken: string;
    let strangerOwnerToken: string;

    beforeAll(async () => {
      const strangerClient = await request(http)
        .post('/api/v1/auth/register')
        .send({
          email: `stranger.client.${runId}@pensiones.dev`,
          password,
          fullName: 'Cliente Ajeno',
        })
        .expect(201);
      strangerClientToken = strangerClient.body.data.accessToken;

      // A second restaurant admin WITH their own restaurant.
      const strangerOwner = await request(http)
        .post('/api/v1/auth/register')
        .send({
          email: `stranger.owner.${runId}@pensiones.dev`,
          password,
          fullName: 'Dueño Ajeno',
          role: 'RESTAURANT_ADMIN',
        })
        .expect(201);
      strangerOwnerToken = strangerOwner.body.data.accessToken;
      await request(http)
        .post('/api/v1/restaurants/mine')
        .set('Authorization', `Bearer ${strangerOwnerToken}`)
        .send({
          name: `Ajeno E2E ${runId}`,
          description: 'Restaurante de otro dueño para pruebas de aislamiento.',
          address: 'Av. Ajena 1, Lima',
          contactPhone: '+51 999 000 111',
          contactEmail: `ajeno.${runId}@pensiones.dev`,
          monthlyPensionPrice: 100,
        })
        .expect(201);
    });

    it('another client cannot read the pension', async () => {
      const res = await request(http)
        .get(`/api/v1/pensions/mine/${pensionId}`)
        .set('Authorization', `Bearer ${strangerClientToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('PENSION_NOT_FOUND');
    });

    it('another restaurant cannot read it, pay it, or change its status', async () => {
      await request(http)
        .get(`/api/v1/restaurants/mine/pensions/${pensionId}`)
        .set('Authorization', `Bearer ${strangerOwnerToken}`)
        .expect(404);

      await request(http)
        .post(`/api/v1/restaurants/mine/pensions/${pensionId}/payments`)
        .set('Authorization', `Bearer ${strangerOwnerToken}`)
        .send({ amount: 10, method: 'CASH' })
        .expect(404);

      await request(http)
        .patch(`/api/v1/restaurants/mine/pensions/${pensionId}/status`)
        .set('Authorization', `Bearer ${strangerOwnerToken}`)
        .send({ status: 'CANCELLED' })
        .expect(404);
    });
  });

  describe('expiration (UTC-consistent)', () => {
    it('the daily sweep expires pensions whose period ended', async () => {
      // Backdate the whole period 31 days (CHECK end = start + 30 holds).
      const row = await prisma.pension.findUniqueOrThrow({
        where: { id: pensionId },
      });
      await prisma.pension.update({
        where: { id: pensionId },
        data: {
          startDate: addUtcDays(row.startDate, -31),
          endDate: addUtcDays(row.endDate, -31),
        },
      });

      const expired = await expirePensions.execute();
      expect(expired).toBeGreaterThanOrEqual(1);

      const res = await request(http)
        .get(`/api/v1/pensions/mine/${pensionId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
      expect(res.body.data.status).toBe('EXPIRED');
      expect(res.body.data.daysRemaining).toBe(0);
    });

    it('the sweep is idempotent', async () => {
      // The already-expired pension must not be touched again.
      const before = await prisma.pension.findUniqueOrThrow({
        where: { id: pensionId },
      });
      await expirePensions.execute();
      const after = await prisma.pension.findUniqueOrThrow({
        where: { id: pensionId },
      });
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });

    it('after expiry the client can contract again; cancelling a partially-paid pension voids the payments', async () => {
      const recontract = await request(http)
        .post('/api/v1/pensions')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ restaurantId })
        .expect(201);
      const newId = recontract.body.data.id;

      // Partial prepayment, then cancellation → refund trail (VOIDED).
      await request(http)
        .post(`/api/v1/restaurants/mine/pensions/${newId}/payments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ amount: 50, method: 'CASH' })
        .expect(201);

      const cancelled = await request(http)
        .post(`/api/v1/pensions/mine/${newId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
      expect(cancelled.body.data.status).toBe('CANCELLED');

      const detail = await request(http)
        .get(`/api/v1/pensions/mine/${newId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
      expect(detail.body.data.paidTotal).toBe(0);
      expect(detail.body.data.payments).toHaveLength(1);
      expect(detail.body.data.payments[0].status).toBe('VOIDED');
    });

    it('rejects a paidAt outside the pension timeline', async () => {
      const recontract = await request(http)
        .post('/api/v1/pensions')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ restaurantId })
        .expect(201);
      const newId = recontract.body.data.id;

      const res = await request(http)
        .post(`/api/v1/restaurants/mine/pensions/${newId}/payments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ amount: 10, method: 'CASH', paidAt: '2030-01-01T00:00:00Z' })
        .expect(400);
      expect(res.body.error.code).toBe('INVALID_PAID_AT');

      // Cleanup: cancel so future runs keep a clean slate.
      await request(http)
        .post(`/api/v1/pensions/mine/${newId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
    });
  });
});
