import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';

import { RedisModule } from '@/infra/redis/redis.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { SessionModule } from '@/modules/auth/sessions/session.module';
import { GatewayModule } from '@/modules/gateway/gateway.module';
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
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
