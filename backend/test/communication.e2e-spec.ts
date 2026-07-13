import { INestApplication } from '@nestjs/common';
import { accessCookie } from './support';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * Phase 8 exit criteria (integration):
 *  1. A user cannot join a foreign conversation over WS.
 *  2. Messages persist and are recovered paginated (keyset cursor).
 * Plus: JWT-authenticated handshake, realtime delivery, read indicator.
 * Requires the dev DB (docker compose) migrated + seeded.
 */
describe('Communication (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let baseUrl: string;

  const runId = Date.now();
  const password = 'Password123!';
  const price = 300;

  let ownerToken: string;
  let clientToken: string;
  let intruderToken: string;
  let restaurantId: string;
  let pensionId: string;
  let intruderPensionId: string;
  let conversationId: string;

  const sockets: Socket[] = [];

  const connect = (token?: string): Socket => {
    const socket = io(`${baseUrl}/chat`, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  };

  const connected = (socket: Socket): Promise<void> =>
    new Promise((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', (err) => reject(err));
    });

  const emitAck = <T = Record<string, unknown>>(
    socket: Socket,
    event: string,
    payload: unknown,
  ): Promise<{
    success: boolean;
    data: T | null;
    error: { code: string } | null;
  }> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`ack timeout for ${event}`)),
        4000,
      );
      socket.emit(event, payload, (ack: never) => {
        clearTimeout(timer);
        resolve(ack);
      });
    });

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

    ownerToken = await register(
      `chat.owner.${runId}@pensiones.dev`,
      'Dueño Chat',
      'RESTAURANT_ADMIN',
    );
    const created = await request(http)
      .post('/api/v1/restaurants/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Chat E2E ${runId}`,
        description: 'Restaurante para pruebas del chat en tiempo real.',
        address: 'Av. Chat 8, Lima',
        contactPhone: '+51 999 333 222',
        contactEmail: `chat.${runId}@pensiones.dev`,
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

    clientToken = await register(
      `chat.client.${runId}@pensiones.dev`,
      'Cliente Chat',
    );
    // The intruder is a real client of the SAME restaurant — the strongest
    // version of the foreign-conversation test.
    intruderToken = await register(
      `chat.intruder.${runId}@pensiones.dev`,
      'Cliente Intruso',
    );

    const contract = async (token: string): Promise<string> => {
      const res = await request(http)
        .post('/api/v1/pensions')
        .set('Authorization', `Bearer ${token}`)
        .send({ restaurantId })
        .expect(201);
      return res.body.data.id as string;
    };
    pensionId = await contract(clientToken);
    intruderPensionId = await contract(intruderToken);

    // Fixture here (not in an `it`) so every describe block stands alone
    // under --testNamePattern / sharding.
    const opened = await request(http)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ pensionId })
      .expect(201);
    conversationId = opened.body.data.id;
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.disconnect();
    }
    await app.close();
  });

  describe('conversations (REST)', () => {
    it('a participant opens the channel of their pension (idempotent)', async () => {
      const reopened = await request(http)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ pensionId })
        .expect(201);
      expect(reopened.body.data).toMatchObject({
        id: conversationId,
        pensionId,
        writable: true,
        unreadCount: 0,
      });

      const asOwner = await request(http)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ pensionId })
        .expect(201);
      expect(asOwner.body.data.id).toBe(conversationId);
    });

    it("a non-participant cannot open someone else's channel", async () => {
      await request(http)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${intruderToken}`)
        .send({ pensionId })
        .expect(404);
    });

    it('messages persist and both sides read the history', async () => {
      await request(http)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ content: 'Hola, ¿mañana hay ají de gallina?' })
        .expect(201);

      const res = await request(http)
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].content).toBe(
        'Hola, ¿mañana hay ají de gallina?',
      );
      expect(res.body.data.nextCursor).toBeNull();
    });

    it('history is keyset-paginated (exit criterion F8)', async () => {
      for (let i = 1; i <= 5; i += 1) {
        await request(http)
          .post(`/api/v1/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ content: `Respuesta ${i}` })
          .expect(201);
      }

      const page1 = await request(http)
        .get(`/api/v1/conversations/${conversationId}/messages?limit=4`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
      expect(page1.body.data.items).toHaveLength(4);
      expect(page1.body.data.nextCursor).not.toBeNull();

      const page2 = await request(http)
        .get(
          `/api/v1/conversations/${conversationId}/messages?limit=4&cursor=${encodeURIComponent(
            page1.body.data.nextCursor,
          )}`,
        )
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
      expect(page2.body.data.items).toHaveLength(2);
      expect(page2.body.data.nextCursor).toBeNull();

      const ids = new Set(
        [...page1.body.data.items, ...page2.body.data.items].map(
          (m: { id: string }) => m.id,
        ),
      );
      expect(ids.size).toBe(6);
    });

    it('a non-participant cannot read the history', async () => {
      await request(http)
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${intruderToken}`)
        .expect(404);
    });

    it('the read indicator stamps the counterpart messages', async () => {
      const marked = await request(http)
        .post(`/api/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
      expect(marked.body.data.updated).toBe(5);

      const list = await request(http)
        .get('/api/v1/conversations/mine')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
      const mine = list.body.data.items.find(
        (c: { id: string }) => c.id === conversationId,
      );
      expect(mine.unreadCount).toBe(0);
      expect(mine.lastMessage.content).toBe('Respuesta 5');
    });
  });

  describe('chat gateway (WS)', () => {
    it('rejects sockets without a valid JWT', async () => {
      const socket = connect();
      await new Promise<void>((resolve) => {
        socket.on('disconnect', () => resolve());
      });
      expect(socket.connected).toBe(false);
    });

    it('a foreign user cannot join the room (exit criterion F8)', async () => {
      const socket = connect(intruderToken);
      await connected(socket);

      const ack = await emitAck(socket, 'conversation:join', {
        conversationId,
      });
      expect(ack.success).toBe(false);
      expect(ack.error?.code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('participants join, exchange messages in realtime and persist them', async () => {
      const clientSocket = connect(clientToken);
      const ownerSocket = connect(ownerToken);
      await Promise.all([connected(clientSocket), connected(ownerSocket)]);

      const joins = await Promise.all([
        emitAck(clientSocket, 'conversation:join', { conversationId }),
        emitAck(ownerSocket, 'conversation:join', { conversationId }),
      ]);
      expect(joins.every((ack) => ack.success)).toBe(true);

      const received = new Promise<{ content: string; senderId: string }>(
        (resolve) => ownerSocket.on('message:new', resolve),
      );
      const ack = await emitAck<{ id: string }>(clientSocket, 'message:send', {
        conversationId,
        content: 'Llego 12:30 ¿me guardas mesa?',
      });
      expect(ack.success).toBe(true);

      const delivered = await received;
      expect(delivered.content).toBe('Llego 12:30 ¿me guardas mesa?');

      const history = await request(http)
        .get(`/api/v1/conversations/${conversationId}/messages?limit=1`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(history.body.data.items[0].id).toBe(ack.data?.id);
    });

    it('read receipts are broadcast to the room', async () => {
      const clientSocket = connect(clientToken);
      const ownerSocket = connect(ownerToken);
      await Promise.all([connected(clientSocket), connected(ownerSocket)]);
      await emitAck(clientSocket, 'conversation:join', { conversationId });
      await emitAck(ownerSocket, 'conversation:join', { conversationId });

      const receipt = new Promise<{ readerId: string; updated: number }>(
        (resolve) => clientSocket.on('message:read', resolve),
      );
      const ack = await emitAck<{ updated: number }>(
        ownerSocket,
        'conversation:read',
        { conversationId },
      );
      expect(ack.success).toBe(true);
      expect(ack.data?.updated).toBeGreaterThan(0);

      const broadcast = await receipt;
      expect(broadcast.updated).toBe(ack.data?.updated);
    });

    it('sending into a foreign conversation fails even with a valid socket', async () => {
      // The intruder authenticates fine and even has their own conversation…
      const socket = connect(intruderToken);
      await connected(socket);
      const own = await request(http)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${intruderToken}`)
        .send({ pensionId: intruderPensionId })
        .expect(201);
      const ownJoin = await emitAck(socket, 'conversation:join', {
        conversationId: own.body.data.id,
      });
      expect(ownJoin.success).toBe(true);

      // …but cannot write into someone else's.
      const ack = await emitAck(socket, 'message:send', {
        conversationId,
        content: 'hola?',
      });
      expect(ack.success).toBe(false);
      expect(ack.error?.code).toBe('CONVERSATION_NOT_FOUND');
    });
  });
});
