import { INestApplication } from '@nestjs/common';

/**
 * App wiring shared by main.ts and the e2e test harness so tests exercise
 * the exact production configuration. Global pipe/filter/interceptor are
 * registered by CoreModule through DI and need no setup here.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
}
