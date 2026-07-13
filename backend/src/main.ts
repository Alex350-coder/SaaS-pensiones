import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { AppConfigService } from './core/config/app-config.service';
import { requestLogger } from './core/http/request-logger.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  // Structured JSON access log with a correlation id (X-Request-Id).
  app.use(requestLogger);

  const config = app.get(AppConfigService);
  await app.listen(config.port);
  new Logger('Bootstrap').log(
    `API ready at http://localhost:${config.port}/api/v1 (${config.nodeEnv})`,
  );
}

void bootstrap();
