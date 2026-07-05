import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppConfigModule } from './config/app-config.module';
import { ExampleRestaurantsController } from './example/example-restaurants.controller';
import { ExampleRestaurantsService } from './example/example-restaurants.service';
import { HealthController } from './health/health.controller';
import { AllExceptionsFilter } from './http/all-exceptions.filter';
import { TransformInterceptor } from './http/transform.interceptor';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Cross-cutting module: typed config, Prisma adapter, response envelope,
 * validation, error mapping and health. Bounded contexts (src/modules/*)
 * build on top of this and never re-register these globals.
 */
@Module({
  imports: [AppConfigModule, PrismaModule],
  controllers: [HealthController, ExampleRestaurantsController],
  providers: [
    ExampleRestaurantsService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class CoreModule {}
