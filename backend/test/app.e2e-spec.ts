import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * Core smoke tests (Phase 2 exit criteria). Require the dev DB from
 * docker-compose up (migrated + `pnpm db:grants` applied).
 */
describe('Core module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns a success envelope with DB up', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('up');
  });

  it('GET /api/v1/example/restaurants returns paginated envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/example/restaurants')
      .query({ page: 1, limit: 2 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeLessThanOrEqual(2);
    expect(res.body.data.meta).toMatchObject({ page: 1, limit: 2 });
    expect(typeof res.body.data.meta.total).toBe('number');
    expect(typeof res.body.data.meta.totalPages).toBe('number');
  });

  it('rejects invalid pagination with a VALIDATION_ERROR envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/example/restaurants')
      .query({ limit: 0 })
      .expect(400);

    expect(res.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('rejects unknown query params (whitelist + forbidNonWhitelisted)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/example/restaurants')
      .query({ hacker: '1' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a NOT_FOUND envelope for unknown routes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .expect(404);

    expect(res.body).toMatchObject({
      success: false,
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'El recurso solicitado no existe.',
      },
    });
  });
});
