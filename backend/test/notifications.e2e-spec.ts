import { INestApplication } from '@nestjs/common';
import { accessCookie } from './support';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { addUtcDays, todayUtc } from '../src/core/dates/utc-date';
import { ExpiringPensionsNotifierService } from '../src/modules/communication/application/expiring-pensions-notifier.service';

/**
 * Phase 9 exit criteria (integration):
 *  1. An aviso reaches ONLY the ACTIVE pensioners of the emitting restaurant.
 *  2. The unread counter stays consistent after marking as read.
 * Plus: WS push while connected, NEW_MESSAGE dedupe + clearing, notice read
 * stamping, and the idempotent PENSION_EXPIRING sweep.
 * Requires the dev DB (docker compose) migrated + seeded.
 */
describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let baseUrl: string;
  let prisma: PrismaService;

  const runId = Date.now();
  const password = 'Password123!';
  const price = 300;

  let ownerAToken: string;
  let ownerBToken: string;
  let clientAToken: string;
  let clientBToken: string;
  let clientPendingToken: string;
  let restaurantAId: string;
  let pensionAId: string;
  let noticeOneId: string;
  let noticeTwoId: string;

  const sockets: Socket[] = [];

  const connect = (token?: string): Socket => {
    const socket = io(`${baseUrl}/notifications`, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  };

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

  const createApprovedRestaurant = async (
    ownerToken: string,
    name: string,
    superAdminToken: string,
  ): Promise<string> => {
    const created = await request(http)
      .post('/api/v1/restaurants/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name,
        description: 'Restaurante para pruebas de notificaciones.',
        address: 'Av. Notificaciones 9, Lima',
        contactPhone: '+51 999 111 000',
        contactEmail: `noti.${name.replace(/\s+/g, '.').toLowerCase()}@pensiones.dev`,
        monthlyPensionPrice: price,
      })
      .expect(201);
    const id = created.body.data.id as string;
    await request(http)
      .patch(`/api/v1/admin/restaurants/${id}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);
    return id;
  };

  const contractPension = async (
    clientToken: string,
    restaurantId: string,
  ): Promise<string> => {
    const res = await request(http)
      .post('/api/v1/pensions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ restaurantId })
      .expect(201);
    return res.body.data.id as string;
  };

  const activatePension = async (
    ownerToken: string,
    pensionId: string,
  ): Promise<void> => {
    await request(http)
      .post(`/api/v1/restaurants/mine/pensions/${pensionId}/payments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: price, method: 'CASH' })
      .expect(201);
  };

  const unreadCount = async (token: string): Promise<number> => {
    const res = await request(http)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body.data.unread as number;
  };

  const listNotifications = async (
    token: string,
  ): Promise<
    {
      id: string;
      type: string;
      payload: Record<string, unknown>;
      readAt: string | null;
    }[]
  > => {
    const res = await request(http)
      .get('/api/v1/notifications?limit=100')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body.data.items as {
      id: string;
      type: string;
      payload: Record<string, unknown>;
      readAt: string | null;
    }[];
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    // The gateway needs a real listening server, not just init().
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
    http = app.getHttpServer();
    prisma = app.get(PrismaService);

    const superAdmin = await request(http)
      .post('/api/v1/auth/login')
      .send({ email: 'superadmin@pensiones.dev', password })
      .expect(200);
    const superAdminToken = accessCookie(superAdmin);

    ownerAToken = await register(
      `noti.owner.a.${runId}@pensiones.dev`,
      'Dueño Noti A',
      'RESTAURANT_ADMIN',
    );
    ownerBToken = await register(
      `noti.owner.b.${runId}@pensiones.dev`,
      'Dueño Noti B',
      'RESTAURANT_ADMIN',
    );
    restaurantAId = await createApprovedRestaurant(
      ownerAToken,
      `Noti A ${runId}`,
      superAdminToken,
    );
    const restaurantBId = await createApprovedRestaurant(
      ownerBToken,
      `Noti B ${runId}`,
      superAdminToken,
    );

    // clientA: ACTIVE at A. clientB: ACTIVE at B (must NOT receive A's
    // avisos). clientPending: PENDING_PAYMENT at A (not ACTIVE → excluded).
    clientAToken = await register(
      `noti.client.a.${runId}@pensiones.dev`,
      'Cliente Noti A',
    );
    clientBToken = await register(
      `noti.client.b.${runId}@pensiones.dev`,
      'Cliente Noti B',
    );
    clientPendingToken = await register(
      `noti.client.pending.${runId}@pensiones.dev`,
      'Cliente Noti Pendiente',
    );

    pensionAId = await contractPension(clientAToken, restaurantAId);
    await activatePension(ownerAToken, pensionAId);
    const pensionBId = await contractPension(clientBToken, restaurantBId);
    await activatePension(ownerBToken, pensionBId);
    await contractPension(clientPendingToken, restaurantAId);
  }, 60_000);

  afterAll(async () => {
    for (const socket of sockets) {
      socket.disconnect();
    }
    await app.close();
  });

  describe('avisos: fan-out scoped to the emitting restaurant (exit criterion 1)', () => {
    it('publishes and materializes notifications for ACTIVE pensioners only', async () => {
      const res = await request(http)
        .post('/api/v1/restaurants/mine/notices')
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({
          title: 'Cierre por feriado',
          body: 'El martes 14 no atenderemos. Disculpen las molestias.',
          type: 'CLOSURE',
        })
        .expect(201);
      noticeOneId = res.body.data.id;
      expect(res.body.data.recipientCount).toBe(1);

      const clientAItems = await listNotifications(clientAToken);
      const delivered = clientAItems.filter(
        (n) => n.type === 'NOTICE' && n.payload.noticeId === noticeOneId,
      );
      expect(delivered).toHaveLength(1);
      expect(delivered[0].payload).toMatchObject({
        restaurantId: restaurantAId,
        noticeType: 'CLOSURE',
        title: 'Cierre por feriado',
      });

      // A pensioner of ANOTHER restaurant receives nothing.
      const clientBItems = await listNotifications(clientBToken);
      expect(
        clientBItems.some((n) => n.payload.noticeId === noticeOneId),
      ).toBe(false);

      // A non-ACTIVE pensioner of the SAME restaurant receives nothing.
      const pendingItems = await listNotifications(clientPendingToken);
      expect(
        pendingItems.some((n) => n.payload.noticeId === noticeOneId),
      ).toBe(false);
    });

    it('rejects a client trying to publish (RBAC)', async () => {
      await request(http)
        .post('/api/v1/restaurants/mine/notices')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ title: 'Hack', body: 'No debería poder.' })
        .expect(403);
    });

    it('validates the aviso payload', async () => {
      await request(http)
        .post('/api/v1/restaurants/mine/notices')
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ title: '', body: 'Sin título.' })
        .expect(400);
    });
  });

  describe('WS push while connected', () => {
    it('delivers notification:new to the recipient and drops anonymous sockets', async () => {
      const socket = connect(clientAToken);
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', (err) => reject(err));
      });

      const pushed = new Promise<{ payload: Record<string, unknown> }>(
        (resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('notification:new never arrived')),
            4000,
          );
          socket.on(
            'notification:new',
            (view: { payload: Record<string, unknown> }) => {
              clearTimeout(timer);
              resolve(view);
            },
          );
        },
      );

      const res = await request(http)
        .post('/api/v1/restaurants/mine/notices')
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ title: 'Nueva promo', body: 'Menú criollo con descuento.' })
        .expect(201);
      noticeTwoId = res.body.data.id;

      const view = await pushed;
      expect(view.payload.noticeId).toBe(noticeTwoId);
      socket.disconnect();

      // Unauthenticated handshake: the server terminates the socket.
      const anonymous = connect();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('anonymous socket was not dropped')),
          4000,
        );
        anonymous.on('disconnect', () => {
          clearTimeout(timer);
          resolve();
        });
        // Depending on timing the server may refuse the handshake outright.
        anonymous.on('connect_error', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    });
  });

  describe('unread counter consistency (exit criterion 2)', () => {
    it('counts, drops on markRead, is idempotent, and read-all zeroes it', async () => {
      expect(await unreadCount(clientAToken)).toBe(2);

      const items = await listNotifications(clientAToken);
      const first = items.find((n) => n.payload.noticeId === noticeOneId)!;

      const marked = await request(http)
        .post(`/api/v1/notifications/${first.id}/read`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
      expect(marked.body.data.readAt).not.toBeNull();
      expect(await unreadCount(clientAToken)).toBe(1);

      // Idempotent re-read: the counter must not drift.
      await request(http)
        .post(`/api/v1/notifications/${first.id}/read`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
      expect(await unreadCount(clientAToken)).toBe(1);

      // Foreign notification: same 404 as a missing one.
      await request(http)
        .post(`/api/v1/notifications/${first.id}/read`)
        .set('Authorization', `Bearer ${clientBToken}`)
        .expect(404);

      const readAll = await request(http)
        .post('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
      expect(readAll.body.data.updated).toBe(1);
      expect(await unreadCount(clientAToken)).toBe(0);

      const unreadOnly = await request(http)
        .get('/api/v1/notifications?unread=true')
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
      expect(unreadOnly.body.data.items).toHaveLength(0);
      expect(unreadOnly.body.data.meta.total).toBe(0);
    });
  });

  describe('notice detail and read stamping', () => {
    it('a recipient reads the aviso; the restaurant sees the read count', async () => {
      const detail = await request(http)
        .get(`/api/v1/notices/${noticeOneId}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
      expect(detail.body.data).toMatchObject({
        id: noticeOneId,
        title: 'Cierre por feriado',
        restaurant: { id: restaurantAId },
      });
      expect(detail.body.data.readCount).toBeUndefined();

      const mine = await request(http)
        .get('/api/v1/restaurants/mine/notices')
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(200);
      const byId = new Map(
        (mine.body.data.items as { id: string; readCount: number }[]).map(
          (n) => [n.id, n.readCount],
        ),
      );
      expect(byId.get(noticeOneId)).toBe(1);
      expect(byId.get(noticeTwoId)).toBe(0);
    });

    it('a non-recipient gets the same 404 as a missing aviso', async () => {
      await request(http)
        .get(`/api/v1/notices/${noticeOneId}`)
        .set('Authorization', `Bearer ${clientBToken}`)
        .expect(404);
    });
  });

  describe('NEW_MESSAGE bell entries', () => {
    let conversationId: string;

    it('one unread bell entry per conversation, cleared on read', async () => {
      const opened = await request(http)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ pensionId: pensionAId })
        .expect(201);
      conversationId = opened.body.data.id;

      await request(http)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ content: '¿Mañana hay ají de gallina?' })
        .expect(201);
      expect(await unreadCount(ownerAToken)).toBe(1);

      // A burst of messages must not pile up bell entries (dedupe).
      await request(http)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ content: '¿Y causa de entrada?' })
        .expect(201);
      expect(await unreadCount(ownerAToken)).toBe(1);

      const ownerItems = await listNotifications(ownerAToken);
      const bell = ownerItems.filter(
        (n) =>
          n.type === 'NEW_MESSAGE' &&
          n.payload.conversationId === conversationId,
      );
      expect(bell).toHaveLength(1);

      // Reading the conversation clears its bell entry too.
      await request(http)
        .post(`/api/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(200);
      expect(await unreadCount(ownerAToken)).toBe(0);

      // And the counterpart direction works symmetrically.
      await request(http)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ content: 'Sí, mañana toca ají de gallina.' })
        .expect(201);
      expect(await unreadCount(clientAToken)).toBe(1);
      await request(http)
        .post('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
    });
  });

  describe('vencimientos: PENSION_EXPIRING sweep', () => {
    it('warns once per pension inside the window; re-runs create nothing', async () => {
      // Backdate the ACTIVE pension so it ends inside the warning window
      // (start moves too: the DB enforces the exact 30-day span).
      const endDate = addUtcDays(todayUtc(), 2);
      await prisma.pension.update({
        where: { id: pensionAId },
        data: { startDate: addUtcDays(endDate, -30), endDate },
      });

      const notifier = app.get(ExpiringPensionsNotifierService);
      await notifier.sweep();
      await notifier.sweep(); // idempotence: the second pass dedupes

      const items = await listNotifications(clientAToken);
      const warnings = items.filter(
        (n) =>
          n.type === 'PENSION_EXPIRING' && n.payload.pensionId === pensionAId,
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0].payload).toMatchObject({ daysRemaining: 2 });
    });
  });
});
