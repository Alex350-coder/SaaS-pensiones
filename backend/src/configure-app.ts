import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppConfigService } from './core/config/app-config.service';

/**
 * App wiring shared by main.ts and the e2e test harness so tests exercise
 * the exact production configuration. Global pipe/filter/interceptor are
 * registered by CoreModule through DI and need no setup here.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfigService);

  // Security headers (docs/security.md §5, A05). The page-level CSP for the
  // SPA is served by nginx; API responses are JSON, so CSP here would only
  // add noise — disable it and keep HSTS + the framing/sniff/referrer set.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      // docs/security.md §5 specifies DENY (helmet defaults to SAMEORIGIN).
      frameguard: { action: 'deny' },
    }),
  );

  // Auth uses httpOnly cookies (docs/security.md A2/A8); parse them before the
  // guards run.
  app.use(cookieParser());

  // Same-origin in production (nginx reverse proxy) needs no browser CORS; the
  // allow-list is defense-in-depth for any direct/cross-origin API client.
  // `credentials: true` is required because auth travels in cookies.
  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
}
