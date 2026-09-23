import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppConfigService } from '@/config/app-config.service';
import { AppConfigModule } from '@/config/config.module';
import { RedisModule } from '@/infra/redis/redis.module';
import { RedisThrottlerStorage } from '@/infra/throttler/redis-throttler.storage';
import { ThrottlerInfraModule } from '@/infra/throttler/throttler-infra.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { GatewayModule } from '@/modules/gateway/gateway.module';
import { SessionModule } from '@/modules/sessions/session.module';
import { HealthController } from '@/shared/controllers/health.controller';
import { SharedModule } from '@/shared/shared.module';

@Module({
  imports: [
    AppConfigModule,
    TerminusModule,
    SharedModule,
    RedisModule,
    SessionModule,
    AuthModule,
    GatewayModule,
    ThrottlerModule.forRootAsync({
      imports: [ThrottlerInfraModule],
      inject: [RedisThrottlerStorage, AppConfigService],
      useFactory: (storage: RedisThrottlerStorage, cfg: AppConfigService) => ({
        throttlers: [
          { name: 'default', ttl: cfg.throttle.ttlSeconds * 1000, limit: cfg.throttle.defaultLimit },
          { name: 'strict', ttl: cfg.throttle.ttlSeconds * 1000, limit: cfg.throttle.strictLimit },
        ],
        storage,
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
