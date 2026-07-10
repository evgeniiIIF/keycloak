import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { RedisService } from './services/redis.service';
import { JwksService } from './services/jwks.service';
import { KeycloakClient } from './services/keycloak-client';
import { AuthService } from './services/auth.service';
import { HttpClient } from './services/http-client';

import { AuthController } from './controllers/auth.controller';
import { ProxyController } from './controllers/proxy.controller';
import { HealthController } from './controllers/health.controller';
import { BackchannelController } from './controllers/backchannel.controller';

import { SessionContextInterceptor } from './interceptors/session-context.interceptor';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    TerminusModule,
  ],
  controllers: [AuthController, ProxyController, HealthController, BackchannelController],
  providers: [
    RedisService,
    JwksService,
    KeycloakClient,
    AuthService,
    HttpClient,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: SessionContextInterceptor },
  ],
  exports: [RedisService],
})
export class AppModule {}
