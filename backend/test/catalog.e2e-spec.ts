import { INestApplication } from '@nestjs/common';
import { accessCookie } from './support';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * Phase 4 exit criteria (integration):
 *  1. A PENDING or SUSPENDED restaurant never appears in the public catalog.
 *  2. A RESTAURANT_ADMIN can only edit their own restaurant.
 * Requires the dev DB (docker compose) migrated + seeded.
 */
describe('Restaurant catalog (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  const runId = Date.now();
  const password = 'Password123!';
  let ownerToken: string;
  let otherAdminToken: string;
  let clientToken: string;
  let superAdminToken: string;
  let slug: string;
  let restaurantId: string;

  const register = async (
    email: string,
    role: 'CLIENT' | 'RESTAURANT_ADMIN',
  ): Promise<string> => {
    const res = await request(http)
      .post('/api/v1/auth/register')
      .send({ email, password, fullName: `E2E ${role}`, role })
      .expect(201);
    return accessCookie(res);
  };

  const publicSlugs = async (): Promise<string[]> => {
    const res = await request(http)
      .get('/api/v1/restaurants')
      .query({ page: 1, limit: 100 })
      .expect(200);
    const items = res.body.data.items as Array<{ slug: string }>;
    return items.map((item) => item.slug);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = app.getHttpServer();

    ownerToken = await register(
      `owner.${runId}@pensiones.dev`,
      'RESTAURANT_ADMIN',
    );
    otherAdminToken = await register(
      `other.${runId}@pensiones.dev`,
      'RESTAURANT_ADMIN',
    );
    clientToken = await register(`client.${runId}@pensiones.dev`, 'CLIENT');

    const login = await request(http)
      .post('/api/v1/auth/login')
      .send({ email: 'superadmin@pensiones.dev', password })
      .expect(200);
    superAdminToken = accessCookie(login);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('lifecycle: PENDING -> APPROVED <-> SUSPENDED', () => {
    it('a RESTAURANT_ADMIN creates their restaurant as PENDING', async () => {
      const res = await request(http)
        .post('/api/v1/restaurants/mine')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: `Fonda E2E ${runId}`,
          description: 'Comida casera para las pruebas e2e.',
          address: 'Calle Falsa 123, Lima',
          contactPhone: '+51 999 111 222',
          contactEmail: `fonda.${runId}@pensiones.dev`,
          monthlyPensionPrice: 299.9,
        })
        .expect(201);

      expect(res.body.data.status).toBe('PENDING');
      slug = res.body.data.slug;
      restaurantId = res.body.data.id;
    });

    it('a second restaurant for the same owner is rejected', async () => {
      const res = await request(http)
        .post('/api/v1/restaurants/mine')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Otro Local',
          description: 'No debería poder crearse.',
          address: 'Calle Falsa 456, Lima',
          contactPhone: '+51 999 111 333',
          contactEmail: `otro.${runId}@pensiones.dev`,
          monthlyPensionPrice: 100,
        })
        .expect(409);

      expect(res.body.error.code).toBe('RESTAURANT_ALREADY_EXISTS');
    });

    it('a PENDING restaurant is invisible in the public catalog', async () => {
      expect(await publicSlugs()).not.toContain(slug);
      const res = await request(http)
        .get(`/api/v1/restaurants/${slug}`)
        .expect(404);
      expect(res.body.error.code).toBe('RESTAURANT_NOT_FOUND');
    });

    it('only the SUPER_ADMIN can change status', async () => {
      for (const token of [ownerToken, clientToken]) {
        const res = await request(http)
          .patch(`/api/v1/admin/restaurants/${restaurantId}/status`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'APPROVED' })
          .expect(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('SUPER_ADMIN approves it and it appears in the public catalog', async () => {
      const res = await request(http)
        .patch(`/api/v1/admin/restaurants/${restaurantId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);
      expect(res.body.data.status).toBe('APPROVED');

      expect(await publicSlugs()).toContain(slug);
      const detail = await request(http)
        .get(`/api/v1/restaurants/${slug}`)
        .expect(200);
      expect(detail.body.data).toMatchObject({
        slug,
        monthlyPensionPrice: 299.9,
      });
      // Status is an operational field, never exposed publicly.
      expect(detail.body.data).not.toHaveProperty('status');
    });

    it('re-approving an APPROVED restaurant is an invalid transition', async () => {
      const res = await request(http)
        .patch(`/api/v1/admin/restaurants/${restaurantId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'APPROVED' })
        .expect(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('suspension removes it from the public catalog immediately', async () => {
      await request(http)
        .patch(`/api/v1/admin/restaurants/${restaurantId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(200);

      expect(await publicSlugs()).not.toContain(slug);
      await request(http).get(`/api/v1/restaurants/${slug}`).expect(404);

      // Back to APPROVED for the remaining tests.
      await request(http)
        .patch(`/api/v1/admin/restaurants/${restaurantId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);
    });
  });

  describe('ownership (a RESTAURANT_ADMIN only manages their own restaurant)', () => {
    it('the owner updates their profile via /restaurants/mine', async () => {
      const res = await request(http)
        .patch('/api/v1/restaurants/mine')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ description: 'Descripción actualizada por el dueño.' })
        .expect(200);
      expect(res.body.data.description).toBe(
        'Descripción actualizada por el dueño.',
      );
    });

    it('rejects explicit null on a NOT NULL field with a 400 (not a 500)', async () => {
      const res = await request(http)
        .patch('/api/v1/restaurants/mine')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ contactPhone: null })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('an admin without a restaurant cannot touch anyone else’s', async () => {
      const res = await request(http)
        .patch('/api/v1/restaurants/mine')
        .set('Authorization', `Bearer ${otherAdminToken}`)
        .send({ description: 'Intento de edición ajena.' })
        .expect(404);
      expect(res.body.error.code).toBe('RESTAURANT_NOT_FOUND');

      // The victim's data is untouched.
      const detail = await request(http)
        .get(`/api/v1/restaurants/${slug}`)
        .expect(200);
      expect(detail.body.data.description).toBe(
        'Descripción actualizada por el dueño.',
      );
    });

    it('a CLIENT cannot create or edit restaurants', async () => {
      await request(http)
        .post('/api/v1/restaurants/mine')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({})
        .expect(403);
      await request(http)
        .patch('/api/v1/restaurants/mine')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({})
        .expect(403);
    });
  });

  describe('schedules and gallery', () => {
    it('replaces the weekly schedule and exposes it publicly', async () => {
      const res = await request(http)
        .put('/api/v1/restaurants/mine/schedules')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          schedules: [
            { dayOfWeek: 1, opensAt: '11:30', closesAt: '16:00' },
            { dayOfWeek: 2, opensAt: '11:30', closesAt: '16:00' },
          ],
        })
        .expect(200);
      expect(res.body.data).toHaveLength(2);

      const detail = await request(http)
        .get(`/api/v1/restaurants/${slug}`)
        .expect(200);
      expect(detail.body.data.schedules).toEqual([
        { dayOfWeek: 1, opensAt: '11:30', closesAt: '16:00' },
        { dayOfWeek: 2, opensAt: '11:30', closesAt: '16:00' },
      ]);
    });

    it('rejects duplicate schedule days', async () => {
      const res = await request(http)
        .put('/api/v1/restaurants/mine/schedules')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          schedules: [
            { dayOfWeek: 1, opensAt: '11:30', closesAt: '16:00' },
            { dayOfWeek: 1, opensAt: '18:00', closesAt: '22:00' },
          ],
        })
        .expect(400);
      expect(res.body.error.code).toBe('DUPLICATE_SCHEDULE_DAY');
    });

    it('adds and removes gallery images', async () => {
      const added = await request(http)
        .post('/api/v1/restaurants/mine/images')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ url: 'https://cdn.pensiones.dev/fotos/e2e.jpg' })
        .expect(201);
      const imageId = added.body.data.id;

      const detail = await request(http)
        .get(`/api/v1/restaurants/${slug}`)
        .expect(200);
      expect(
        detail.body.data.images.map((image: { id: string }) => image.id),
      ).toContain(imageId);

      await request(http)
        .delete(`/api/v1/restaurants/mine/images/${imageId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });
  });

  describe('super admin listing', () => {
    it('lists restaurants filtered by status', async () => {
      const res = await request(http)
        .get('/api/v1/admin/restaurants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .query({ page: 1, limit: 100, status: 'APPROVED' })
        .expect(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(restaurantId);
      const statuses = res.body.data.items.map(
        (item: { status: string }) => item.status,
      );
      expect(new Set(statuses)).toEqual(new Set(['APPROVED']));
    });
  });
});
