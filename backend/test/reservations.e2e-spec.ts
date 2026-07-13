import { INestApplication } from '@nestjs/common';
import { accessCookie } from './support';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { addUtcDays, formatUtcDate, todayUtc } from '../src/core/dates/utc-date';

/**
 * Phase 7 exit criteria (integration):
 *  1. One live reservation per client per daily menu — enforced by the DB
 *     partial unique uq_live_reservation_per_client_menu.
 *  2. Only pensioners with an ACTIVE pension confirm attendance.
 *  3. The production projection aggregates reservations + confirmations +
 *     unanswered pensioners correctly.
 * Requires the dev DB (docker compose) migrated + seeded.
 */
describe('Reservations & Attendance (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  const runId = Date.now();
  const password = 'Password123!';
  const price = 300;
  const today = formatUtcDate(todayUtc());

  let ownerToken: string;
  let restaurantId: string;
  let dailyMenuId: string;
  // client1: ACTIVE pension; client2: PENDING_PAYMENT; client3: ACTIVE.
  let client1Token: string;
  let client2Token: string;
  let client3Token: string;
  let pension1Id: string;
  let pension2Id: string;
  let pension3Id: string;
  let reservationId: string;

  const register = async (
    email: string,
    fullName: string,
    role?: string,
  ): Promise<string> => {
    const res = await request(http)
      .post('/api/v1/auth/register')
      .send({ email, password, fullName, ...(role ? { role } : {}) })
      .expect(201);
    return accessCookie(res);
  };

  const contractAndMaybePay = async (
    clientToken: string,
    pay: boolean,
  ): Promise<string> => {
    const contracted = await request(http)
      .post('/api/v1/pensions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ restaurantId })
      .expect(201);
    const pensionId = contracted.body.data.id as string;
    if (pay) {
      await request(http)
        .post(`/api/v1/restaurants/mine/pensions/${pensionId}/payments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ amount: price, method: 'CASH' })
        .expect(201);
    }
    return pensionId;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = app.getHttpServer();

    // Owner with an APPROVED restaurant.
    ownerToken = await register(
      `resv.owner.${runId}@pensiones.dev`,
      'Dueño Reservas',
      'RESTAURANT_ADMIN',
    );
    const created = await request(http)
      .post('/api/v1/restaurants/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Reservas E2E ${runId}`,
        description: 'Restaurante para pruebas del sistema de reservas.',
        address: 'Av. Reserva 7, Lima',
        contactPhone: '+51 999 555 444',
        contactEmail: `resv.${runId}@pensiones.dev`,
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
      .set('Authorization', `Bearer ${accessCookie(superAdmin)}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    // Today's PUBLISHED menu with one dish.
    const dish = await request(http)
      .post('/api/v1/restaurants/mine/dishes')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Ají de gallina', category: 'MAIN', price: 15 })
      .expect(201);
    await request(http)
      .post('/api/v1/restaurants/mine/menus')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ menuDate: today, menuPrice: 15 })
      .expect(201);
    await request(http)
      .put(`/api/v1/restaurants/mine/menus/${today}/items`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ items: [{ dishId: dish.body.data.id, course: 'MAIN' }] })
      .expect(200);
    const published = await request(http)
      .patch(`/api/v1/restaurants/mine/menus/${today}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);
    dailyMenuId = published.body.data.id;

    client1Token = await register(
      `resv.client1.${runId}@pensiones.dev`,
      'Cliente Uno Reservas',
    );
    client2Token = await register(
      `resv.client2.${runId}@pensiones.dev`,
      'Cliente Dos Reservas',
    );
    client3Token = await register(
      `resv.client3.${runId}@pensiones.dev`,
      'Cliente Tres Reservas',
    );
    pension1Id = await contractAndMaybePay(client1Token, true);
    pension2Id = await contractAndMaybePay(client2Token, false);
    pension3Id = await contractAndMaybePay(client3Token, true);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('reservations', () => {
    it('the public menu exposes the id needed to reserve', async () => {
      const slug = (
        await request(http)
          .get('/api/v1/restaurants/mine')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200)
      ).body.data.slug;
      const res = await request(http)
        .get(`/api/v1/restaurants/${slug}/menu`)
        .expect(200);
      expect(res.body.data.id).toBe(dailyMenuId);
    });

    it('an active pensioner reserves the day menu', async () => {
      const res = await request(http)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({ dailyMenuId, estimatedArrival: '12:30', notes: 'Sin ají' })
        .expect(201);

      expect(res.body.data).toMatchObject({
        status: 'CONFIRMED',
        menuDate: today,
        estimatedArrival: '12:30',
        pensionId: pension1Id,
      });
      reservationId = res.body.data.id;
    });

    it('a second live reservation for the same menu is rejected by the DB', async () => {
      const res = await request(http)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({ dailyMenuId, estimatedArrival: '13:00' })
        .expect(409);
      expect(res.body.error.code).toBe('RESERVATION_ALREADY_EXISTS');
    });

    it('a client without an active pension cannot reserve', async () => {
      const res = await request(http)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${client2Token}`)
        .send({ dailyMenuId, estimatedArrival: '12:00' })
        .expect(409);
      expect(res.body.error.code).toBe('NO_ACTIVE_PENSION');
    });

    it('a restaurant admin cannot reserve (role guard)', async () => {
      await request(http)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ dailyMenuId, estimatedArrival: '12:00' })
        .expect(403);
    });

    it('the client updates the arrival time while the day is not over', async () => {
      const res = await request(http)
        .patch(`/api/v1/reservations/mine/${reservationId}`)
        .set('Authorization', `Bearer ${client1Token}`)
        .send({ estimatedArrival: '13:15' })
        .expect(200);
      expect(res.body.data.estimatedArrival).toBe('13:15');
    });

    it('explicit null on estimatedArrival is rejected (400)', async () => {
      await request(http)
        .patch(`/api/v1/reservations/mine/${reservationId}`)
        .set('Authorization', `Bearer ${client1Token}`)
        .send({ estimatedArrival: null })
        .expect(400);
    });

    it('cancelling frees the unique slot and allows reserving again', async () => {
      const cancelled = await request(http)
        .post(`/api/v1/reservations/mine/${reservationId}/cancel`)
        .set('Authorization', `Bearer ${client1Token}`)
        .expect(200);
      expect(cancelled.body.data.status).toBe('CANCELLED');

      const res = await request(http)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({ dailyMenuId, estimatedArrival: '12:45' })
        .expect(201);
      expect(res.body.data.status).toBe('CONFIRMED');
      reservationId = res.body.data.id;
    });

    it('a cancelled reservation is no longer modifiable', async () => {
      // The first (cancelled) reservation still exists in the history.
      const list = await request(http)
        .get('/api/v1/reservations/mine?status=CANCELLED')
        .set('Authorization', `Bearer ${client1Token}`)
        .expect(200);
      const cancelledId = list.body.data.items[0].id;

      const res = await request(http)
        .post(`/api/v1/reservations/mine/${cancelledId}/cancel`)
        .set('Authorization', `Bearer ${client1Token}`)
        .expect(409);
      expect(res.body.error.code).toBe('RESERVATION_NOT_MODIFIABLE');
    });

    it('another client cannot see or touch the reservation', async () => {
      await request(http)
        .get(`/api/v1/reservations/mine/${reservationId}`)
        .set('Authorization', `Bearer ${client2Token}`)
        .expect(404);
      await request(http)
        .post(`/api/v1/reservations/mine/${reservationId}/cancel`)
        .set('Authorization', `Bearer ${client2Token}`)
        .expect(404);
    });

    it('the restaurant sees the day reservations with client identity', async () => {
      const res = await request(http)
        .get(`/api/v1/restaurants/mine/reservations?date=${today}&status=CONFIRMED`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.meta.total).toBe(1);
      expect(res.body.data.items[0]).toMatchObject({
        status: 'CONFIRMED',
        estimatedArrival: '12:45',
        client: { fullName: 'Cliente Uno Reservas' },
      });
    });
  });

  describe('attendance', () => {
    it('an active pensioner answers and can change the answer (upsert)', async () => {
      const first = await request(http)
        .put('/api/v1/attendance')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({ pensionId: pension1Id, date: today, status: 'WILL_NOT_ATTEND' })
        .expect(200);
      expect(first.body.data.status).toBe('WILL_NOT_ATTEND');

      const second = await request(http)
        .put('/api/v1/attendance')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({ pensionId: pension1Id, date: today, status: 'WILL_ATTEND' })
        .expect(200);
      expect(second.body.data.id).toBe(first.body.data.id);
      expect(second.body.data.status).toBe('WILL_ATTEND');
    });

    it('a PENDING_PAYMENT pension cannot confirm attendance', async () => {
      const res = await request(http)
        .put('/api/v1/attendance')
        .set('Authorization', `Bearer ${client2Token}`)
        .send({ pensionId: pension2Id, date: today, status: 'WILL_ATTEND' })
        .expect(409);
      expect(res.body.error.code).toBe('PENSION_NOT_ACTIVE');
    });

    it("a client cannot answer for someone else's pension", async () => {
      await request(http)
        .put('/api/v1/attendance')
        .set('Authorization', `Bearer ${client2Token}`)
        .send({ pensionId: pension1Id, date: today, status: 'WILL_ATTEND' })
        .expect(404);
    });

    it('rejects dates outside the pension period and past dates', async () => {
      const outside = await request(http)
        .put('/api/v1/attendance')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
          pensionId: pension1Id,
          date: formatUtcDate(addUtcDays(todayUtc(), 45)),
          status: 'WILL_ATTEND',
        })
        .expect(409);
      expect(outside.body.error.code).toBe('ATTENDANCE_OUT_OF_PERIOD');

      const past = await request(http)
        .put('/api/v1/attendance')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
          pensionId: pension1Id,
          date: formatUtcDate(addUtcDays(todayUtc(), -1)),
          status: 'WILL_ATTEND',
        })
        .expect(409);
      expect(past.body.error.code).toBe('ATTENDANCE_DATE_PAST');
    });
  });

  describe('production projection', () => {
    it('aggregates reservations, answers and unanswered pensioners', async () => {
      // State built above: client1 ACTIVE + WILL_ATTEND + 1 CONFIRMED
      // reservation; client3 ACTIVE, answers WILL_NOT_ATTEND here; client2
      // is PENDING_PAYMENT and must not count.
      await request(http)
        .put('/api/v1/attendance')
        .set('Authorization', `Bearer ${client3Token}`)
        .send({ pensionId: pension3Id, date: today, status: 'WILL_NOT_ATTEND' })
        .expect(200);

      const res = await request(http)
        .get(`/api/v1/restaurants/mine/production-projection?date=${today}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data).toMatchObject({
        date: today,
        reservations: { confirmed: 1 },
        attendance: { willAttend: 1, willNotAttend: 1 },
        pensioners: { active: 2, unanswered: 0 },
        projectedAttendance: 1,
      });
    });

    it('counts unanswered pensioners for a day nobody answered', async () => {
      const tomorrow = formatUtcDate(addUtcDays(todayUtc(), 1));
      const res = await request(http)
        .get(`/api/v1/restaurants/mine/production-projection?date=${tomorrow}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data).toMatchObject({
        reservations: { confirmed: 0 },
        attendance: { willAttend: 0, willNotAttend: 0 },
        pensioners: { active: 2, unanswered: 2 },
        projectedAttendance: 2,
      });
    });

    it('excludes stale answers from pensions that stopped being ACTIVE', async () => {
      // client3 answered WILL_NOT_ATTEND above; suspending the pension must
      // remove both the pensioner and their answer from every bucket.
      await request(http)
        .patch(`/api/v1/restaurants/mine/pensions/${pension3Id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(200);

      const res = await request(http)
        .get(`/api/v1/restaurants/mine/production-projection?date=${today}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data).toMatchObject({
        attendance: { willAttend: 1, willNotAttend: 0 },
        pensioners: { active: 1, unanswered: 0 },
        projectedAttendance: 1,
      });
    });

    it('a client cannot read restaurant views (role guard)', async () => {
      await request(http)
        .get('/api/v1/restaurants/mine/production-projection')
        .set('Authorization', `Bearer ${client1Token}`)
        .expect(403);
    });
  });
});
