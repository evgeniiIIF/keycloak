import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { GatewayModule } from './gateway/gateway.module';
import { SessionModule } from './session/session.module';
import { RedisModule } from './redis/redis.module';
import { SharedModule } from './shared/shared.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { HealthController } from './shared/controllers/health.controller';

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
