import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { AppConfigService } from './core/config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  // Minimal structured request log; replaced by real observability in Phase 18.
  const httpLogger = new Logger('HTTP');
  app.use(
    (
      req: import('express').Request,
      res: import('express').Response,
      next: import('express').NextFunction,
    ) => {
      const startedAt = Date.now();
      res.on('finish', () => {
        httpLogger.log(
          `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`,
        );
      });
      next();
    },
  );

  const config = app.get(AppConfigService);
  await app.listen(config.port);
  new Logger('Bootstrap').log(
    `API ready at http://localhost:${config.port}/api/v1 (${config.nodeEnv})`,
  );
}

void bootstrap();
