import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { config } from '@/config/config';
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
    TerminusModule,
    SharedModule,
    RedisModule,
    SessionModule,
    AuthModule,
    GatewayModule,
    ThrottlerModule.forRootAsync({
      imports: [ThrottlerInfraModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [
          { name: 'default', ttl: config.throttle.ttlSeconds * 1000, limit: config.throttle.defaultLimit },
          { name: 'strict', ttl: config.throttle.ttlSeconds * 1000, limit: config.throttle.strictLimit },
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
