import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { SimulatedInvoiceIssuer } from '../src/modules/billing/infrastructure/simulated-invoice-issuer';

/**
 * Phase 11 exit criteria (integration):
 *  1. Correlative numbering with no gaps or duplicates — even under concurrent
 *     activations of the same restaurant (atomic UPDATE ... RETURNING).
 *  2. The invoice PDF is downloadable from the history (on-demand stream).
 * Also covers ownership scoping (an invoice never leaks across tenants).
 * Requires the dev DB (docker compose) migrated + seeded.
 */
describe('Billing — simulated invoicing (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;

  const runId = Date.now();
  const password = 'Password123!';
  const price = 300;

  let ownerToken: string;
  let restaurantId: string;

  // Collected invoice ids for the download / isolation assertions.
  let firstInvoiceId: string;
  let firstClientToken: string;

  /** Registers a fresh CLIENT and returns their access token. */
  const registerClient = async (tag: string): Promise<string> => {
    const res = await request(http)
      .post('/api/v1/auth/register')
      .send({
        email: `billing.${tag}.${runId}@pensiones.dev`,
        password,
        fullName: `Cliente ${tag}`,
      })
      .expect(201);
    const token: string = res.body.data.accessToken;
    return token;
  };

  /** Contracts a pension for the given client at the shared restaurant. */
  const contract = async (token: string): Promise<string> => {
    const res = await request(http)
      .post('/api/v1/pensions')
      .set('Authorization', `Bearer ${token}`)
      .send({ restaurantId })
      .expect(201);
    const pensionId: string = res.body.data.id;
    return pensionId;
  };

  const pay = (pensionId: string, amount: number): request.Test =>
    request(http)
      .post(`/api/v1/restaurants/mine/pensions/${pensionId}/payments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount, method: 'CASH' });

  /** Reads a binary (PDF) response body into a Buffer. */
  const getBinary = (url: string, token: string): request.Test =>
    request(http)
      .get(url)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);

    const owner = await request(http)
      .post('/api/v1/auth/register')
      .send({
        email: `billing.owner.${runId}@pensiones.dev`,
        password,
        fullName: 'Dueño Billing',
        role: 'RESTAURANT_ADMIN',
      })
      .expect(201);
    ownerToken = owner.body.data.accessToken;

    const created = await request(http)
      .post('/api/v1/restaurants/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Billing E2E ${runId}`,
        description: 'Restaurante para pruebas de facturación simulada.',
        address: 'Av. Factura 1, Lima',
        contactPhone: '+51 999 111 222',
        contactEmail: `billing.${runId}@pensiones.dev`,
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('emission on activation', () => {
    it('does not emit an invoice for a partial payment', async () => {
      firstClientToken = await registerClient('c1');
      const pensionId = await contract(firstClientToken);

      const partial = await pay(pensionId, 100).expect(201);
      expect(partial.body.data.activated).toBe(false);
      expect(partial.body.data.invoice).toBeUndefined();

      // Completing the price activates and emits the first invoice: F001-1.
      const completed = await pay(pensionId, 200).expect(201);
      expect(completed.body.data.activated).toBe(true);
      expect(completed.body.data.invoice).toMatchObject({
        series: 'F001',
        number: 1,
      });
      expect(completed.body.data.invoice.id).toEqual(expect.any(String));
      firstInvoiceId = completed.body.data.invoice.id;
    });

    it('the emitted invoice bills the full contracted price', async () => {
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: firstInvoiceId },
      });
      expect(Number(invoice.total)).toBe(price);
      expect(invoice.status).toBe('ISSUED');
      // On-demand delivery: no file persisted.
      expect(invoice.pdfUrl).toBeNull();
    });
  });

  describe('correlative numbering (exit criterion #1)', () => {
    it('assigns the next number with no gaps for a sequential activation', async () => {
      const token = await registerClient('c2');
      const pensionId = await contract(token);
      const res = await pay(pensionId, price).expect(201);
      expect(res.body.data.invoice).toMatchObject({ series: 'F001', number: 2 });
    });

    it('stays gapless and duplicate-free under concurrent activations', async () => {
      // Two different clients, two pensions at the SAME restaurant, both
      // prepaid to the brink, then activated in parallel. Each activation
      // locks its own pension row but contends on the single series row —
      // the atomic UPDATE ... RETURNING serialises the numbering.
      const tokens = await Promise.all([
        registerClient('c3'),
        registerClient('c4'),
      ]);
      const pensions = await Promise.all(tokens.map((t) => contract(t)));
      await Promise.all(pensions.map((p) => pay(p, 100).expect(201)));

      const results = await Promise.all(pensions.map((p) => pay(p, 200)));
      const numbers = results
        .map((r) => r.body.data.invoice.number as number)
        .sort((a, b) => a - b);

      // The two concurrent activations took 3 and 4, in some order — distinct.
      expect(numbers).toEqual([3, 4]);
    });

    it('the DB holds a contiguous, unique 1..N sequence for the restaurant', async () => {
      const invoices = await prisma.invoice.findMany({
        where: { series: { restaurantId } },
        orderBy: { number: 'asc' },
        select: { number: true },
      });
      const numbers = invoices.map((i) => i.number);
      expect(numbers).toEqual([1, 2, 3, 4]);
      // next_number points just past the last assigned value.
      const series = await prisma.invoiceSeries.findFirstOrThrow({
        where: { restaurantId, series: 'F001' },
      });
      expect(series.nextNumber).toBe(5);
    });
  });

  describe('PDF download (exit criterion #2)', () => {
    it('the restaurant owner downloads the invoice PDF on demand', async () => {
      const res = await getBinary(
        `/api/v1/restaurants/mine/invoices/${firstInvoiceId}/pdf`,
        ownerToken,
      ).expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      const body = res.body as Buffer;
      expect(body.length).toBeGreaterThan(0);
      expect(body.subarray(0, 4).toString('latin1')).toBe('%PDF');
    });

    it('the pensioner downloads the PDF of their own invoice', async () => {
      const res = await getBinary(
        `/api/v1/invoices/${firstInvoiceId}/pdf`,
        firstClientToken,
      ).expect(200);
      expect((res.body as Buffer).subarray(0, 4).toString('latin1')).toBe(
        '%PDF',
      );
    });
  });

  describe('history listing', () => {
    it('the owner lists every invoice of its restaurant, newest first', async () => {
      const res = await request(http)
        .get('/api/v1/restaurants/mine/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.meta.total).toBe(4);
      const ids = res.body.data.items.map((i: { id: string }) => i.id);
      expect(ids).toContain(firstInvoiceId);
      expect(res.body.data.items[0].serial).toMatch(/^F001-\d{6}$/);
    });

    it('the client lists only their own invoices', async () => {
      const res = await request(http)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${firstClientToken}`)
        .expect(200);

      expect(res.body.data.meta.total).toBe(1);
      expect(res.body.data.items[0].id).toBe(firstInvoiceId);
    });
  });

  describe('cross-tenant isolation', () => {
    let strangerClientToken: string;
    let strangerOwnerToken: string;

    beforeAll(async () => {
      strangerClientToken = await registerClient('stranger');

      const strangerOwner = await request(http)
        .post('/api/v1/auth/register')
        .send({
          email: `billing.stranger.owner.${runId}@pensiones.dev`,
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
          name: `Billing Ajeno ${runId}`,
          description: 'Restaurante ajeno para aislamiento de facturación.',
          address: 'Av. Ajena 9, Lima',
          contactPhone: '+51 999 333 444',
          contactEmail: `billing.ajeno.${runId}@pensiones.dev`,
          monthlyPensionPrice: 150,
        })
        .expect(201);
    });

    it('a stranger client sees none of it and cannot download it', async () => {
      const list = await request(http)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${strangerClientToken}`)
        .expect(200);
      expect(list.body.data.meta.total).toBe(0);

      const pdf = await request(http)
        .get(`/api/v1/invoices/${firstInvoiceId}/pdf`)
        .set('Authorization', `Bearer ${strangerClientToken}`)
        .expect(404);
      expect(pdf.body.error.code).toBe('INVOICE_NOT_FOUND');
    });

    it('a stranger restaurant cannot download it', async () => {
      const pdf = await request(http)
        .get(`/api/v1/restaurants/mine/invoices/${firstInvoiceId}/pdf`)
        .set('Authorization', `Bearer ${strangerOwnerToken}`)
        .expect(404);
      expect(pdf.body.error.code).toBe('INVOICE_NOT_FOUND');
    });

    it('roles are enforced on each surface', async () => {
      // Client hitting the owner surface, and owner hitting the client surface.
      await request(http)
        .get('/api/v1/restaurants/mine/invoices')
        .set('Authorization', `Bearer ${firstClientToken}`)
        .expect(403);
      await request(http)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);
    });
  });

  // Voiding is wired defensively: under the "emit only on activation" policy an
  // invoice's payment is never voided through the API (only PENDING pensions
  // void payments, and those have no invoice). We exercise the adapter directly
  // against a real ISSUED row so the void SQL is covered and stays correct.
  describe('void propagation (defensive path)', () => {
    let pensionId: string;

    beforeAll(async () => {
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: firstInvoiceId },
        include: { payment: { select: { pensionId: true } } },
      });
      pensionId = invoice.payment.pensionId;
    });

    it('voids the issued invoice in a transaction without reusing its number', async () => {
      const issuer = app.get(SimulatedInvoiceIssuer);

      const before = await prisma.invoiceSeries.findFirstOrThrow({
        where: { restaurantId, series: 'F001' },
      });

      const voided = await prisma.$transaction((tx) =>
        issuer.voidForPension(tx, pensionId),
      );
      expect(voided).toBe(1);

      const after = await prisma.invoice.findUniqueOrThrow({
        where: { id: firstInvoiceId },
      });
      expect(after.status).toBe('VOIDED');
      // The correlative number is left untouched — no renumbering, no reuse.
      expect(after.number).toBe(1);
      const series = await prisma.invoiceSeries.findFirstOrThrow({
        where: { restaurantId, series: 'F001' },
      });
      expect(series.nextNumber).toBe(before.nextNumber);
    });

    it('is idempotent: a second void affects no already-voided invoice', async () => {
      const issuer = app.get(SimulatedInvoiceIssuer);
      const voided = await prisma.$transaction((tx) =>
        issuer.voidForPension(tx, pensionId),
      );
      expect(voided).toBe(0);
    });
  });
});
