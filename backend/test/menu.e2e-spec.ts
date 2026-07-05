import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * Phase 5 exit criteria (integration):
 *  1. restaurant+date uniqueness for daily menus is enforced by the DB.
 *  2. Only PUBLISHED menus are publicly visible.
 * Requires the dev DB (docker compose) migrated + seeded.
 */
describe('Menu management (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  const runId = Date.now();
  const password = 'Password123!';
  const menuDate = '2031-03-10'; // far future: guaranteed free for this restaurant
  let ownerToken: string;
  let slug: string;
  let mainDishId: string;
  let dessertDishId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = app.getHttpServer();

    // Fresh RESTAURANT_ADMIN with an APPROVED restaurant.
    const registered = await request(http)
      .post('/api/v1/auth/register')
      .send({
        email: `chef.${runId}@pensiones.dev`,
        password,
        fullName: 'Chef E2E',
        role: 'RESTAURANT_ADMIN',
      })
      .expect(201);
    ownerToken = registered.body.data.accessToken;

    const created = await request(http)
      .post('/api/v1/restaurants/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Cocina Menú E2E ${runId}`,
        description: 'Restaurante para las pruebas de menús.',
        address: 'Jr. Menú 555, Lima',
        contactPhone: '+51 999 555 444',
        contactEmail: `cocina.${runId}@pensiones.dev`,
        monthlyPensionPrice: 350,
      })
      .expect(201);
    slug = created.body.data.slug;

    const login = await request(http)
      .post('/api/v1/auth/login')
      .send({ email: 'superadmin@pensiones.dev', password })
      .expect(200);
    await request(http)
      .patch(`/api/v1/admin/restaurants/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('dishes CRUD', () => {
    it('creates dishes per category', async () => {
      const main = await request(http)
        .post('/api/v1/restaurants/mine/dishes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Lomo saltado', category: 'MAIN', price: 18.5 })
        .expect(201);
      mainDishId = main.body.data.id;

      const dessert = await request(http)
        .post('/api/v1/restaurants/mine/dishes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Mazamorra morada', category: 'DESSERT', price: 6 })
        .expect(201);
      dessertDishId = dessert.body.data.id;

      expect(main.body.data).toMatchObject({
        category: 'MAIN',
        price: 18.5,
        isActive: true,
      });
    });

    it('lists own dishes with category filter', async () => {
      const res = await request(http)
        .get('/api/v1/restaurants/mine/dishes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .query({ category: 'MAIN' })
        .expect(200);

      const ids = res.body.data.items.map((d: { id: string }) => d.id);
      expect(ids).toContain(mainDishId);
      expect(ids).not.toContain(dessertDishId);
    });

    it('updates a dish', async () => {
      const res = await request(http)
        .patch(`/api/v1/restaurants/mine/dishes/${mainDishId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ price: 19.9 })
        .expect(200);
      expect(res.body.data.price).toBe(19.9);
    });

    it('a CLIENT cannot manage dishes', async () => {
      const client = await request(http)
        .post('/api/v1/auth/register')
        .send({
          email: `comensal.${runId}@pensiones.dev`,
          password,
          fullName: 'Comensal E2E',
        })
        .expect(201);

      await request(http)
        .post('/api/v1/restaurants/mine/dishes')
        .set('Authorization', `Bearer ${client.body.data.accessToken}`)
        .send({ name: 'Hack', category: 'MAIN', price: 1 })
        .expect(403);
    });
  });

  describe('daily menu lifecycle', () => {
    it('creates a DRAFT menu for a date', async () => {
      const res = await request(http)
        .post('/api/v1/restaurants/mine/menus')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ menuDate, menuPrice: 15 })
        .expect(201);

      expect(res.body.data).toMatchObject({
        menuDate,
        status: 'DRAFT',
        menuPrice: 15,
        items: [],
      });
    });

    it('rejects a second menu for the same date (DB uniqueness)', async () => {
      const res = await request(http)
        .post('/api/v1/restaurants/mine/menus')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ menuDate, menuPrice: 20 })
        .expect(409);
      expect(res.body.error.code).toBe('MENU_ALREADY_EXISTS');
    });

    it('rejects an invalid calendar date', async () => {
      const res = await request(http)
        .post('/api/v1/restaurants/mine/menus')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ menuDate: '2031-02-31', menuPrice: 15 })
        .expect(400);
      expect(res.body.error.code).toBe('INVALID_DATE');
    });

    it('rejects a dish served outside its category', async () => {
      const res = await request(http)
        .put(`/api/v1/restaurants/mine/menus/${menuDate}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ items: [{ dishId: dessertDishId, course: 'STARTER' }] })
        .expect(400);
      expect(res.body.error.code).toBe('COURSE_MISMATCH');
    });

    it('composes the menu with valid items', async () => {
      const res = await request(http)
        .put(`/api/v1/restaurants/mine/menus/${menuDate}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          items: [
            { dishId: mainDishId, course: 'MAIN' },
            { dishId: dessertDishId, course: 'DESSERT' },
          ],
        })
        .expect(200);
      expect(res.body.data.items).toHaveLength(2);
      // Sorted by course order: MAIN before DESSERT.
      expect(res.body.data.items[0].course).toBe('MAIN');
    });

    it('a DRAFT menu is not publicly visible', async () => {
      const res = await request(http)
        .get(`/api/v1/restaurants/${slug}/menu`)
        .query({ date: menuDate })
        .expect(404);
      expect(res.body.error.code).toBe('MENU_NOT_FOUND');
    });

    it('publishing makes it publicly visible with dishes and prices', async () => {
      await request(http)
        .patch(`/api/v1/restaurants/mine/menus/${menuDate}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'PUBLISHED' })
        .expect(200);

      const res = await request(http)
        .get(`/api/v1/restaurants/${slug}/menu`)
        .query({ date: menuDate })
        .expect(200);

      expect(res.body.data).toMatchObject({ menuDate, menuPrice: 15 });
      expect(res.body.data).not.toHaveProperty('status');
      const names = res.body.data.items.map(
        (i: { dish: { name: string } }) => i.dish.name,
      );
      expect(names).toEqual(['Lomo saltado', 'Mazamorra morada']);
    });

    it('a published menu cannot be edited or deleted until unpublished', async () => {
      await request(http)
        .patch(`/api/v1/restaurants/mine/menus/${menuDate}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ menuPrice: 22 })
        .expect(409);

      await request(http)
        .delete(`/api/v1/restaurants/mine/menus/${menuDate}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);

      await request(http)
        .patch(`/api/v1/restaurants/mine/menus/${menuDate}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'DRAFT' })
        .expect(200);

      await request(http)
        .patch(`/api/v1/restaurants/mine/menus/${menuDate}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ menuPrice: 22 })
        .expect(200);
    });

    it('a dish used in a menu cannot be hard-deleted (DISH_IN_USE)', async () => {
      const res = await request(http)
        .delete(`/api/v1/restaurants/mine/dishes/${mainDishId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);
      expect(res.body.error.code).toBe('DISH_IN_USE');
    });

    it('unpublished (back-to-DRAFT) menus disappear from the public view', async () => {
      await request(http)
        .get(`/api/v1/restaurants/${slug}/menu`)
        .query({ date: menuDate })
        .expect(404);
    });
  });
});
