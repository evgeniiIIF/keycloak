import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';

import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { GatewayModule } from './gateway/gateway.module';
import { RedisModule } from './redis/redis.module';
import { SessionModule } from './session/session.module';
import { HealthController } from './shared/controllers/health.controller';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    TerminusModule,
    SharedModule,
    RedisModule,
    SessionModule,
    AuthModule,
    GatewayModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
