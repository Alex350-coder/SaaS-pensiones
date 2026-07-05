import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditService } from './audit/audit.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { ExampleRestaurantsController } from './example/example-restaurants.controller';
import { ExampleRestaurantsService } from './example/example-restaurants.service';
import { HealthController } from './health/health.controller';
import { AllExceptionsFilter } from './http/all-exceptions.filter';
import { TransformInterceptor } from './http/transform.interceptor';
import { PrismaModule } from './prisma/prisma.module';

const GLOBAL_THROTTLE_LIMIT = 100;
const GLOBAL_THROTTLE_TTL_MS = 60_000;

/**
 * Cross-cutting module: typed config, Prisma adapter, response envelope,
 * validation, error mapping, auth guards (deny by default), throttling,
 * audit trail and health. Bounded contexts (src/modules/*) build on top of
 * this and never re-register these globals.
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      global: true,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtAccessSecret,
        signOptions: { expiresIn: config.jwtAccessTtlSeconds },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          { ttl: GLOBAL_THROTTLE_TTL_MS, limit: GLOBAL_THROTTLE_LIMIT },
        ],
        // Integration tests hammer auth endpoints on purpose.
        skipIf: () => config.nodeEnv === 'test',
      }),
    }),
  ],
  controllers: [HealthController, ExampleRestaurantsController],
  providers: [
    AuditService,
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
    // Guard order is registration order: throttle → authenticate → authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuditService],
})
export class CoreModule {}
