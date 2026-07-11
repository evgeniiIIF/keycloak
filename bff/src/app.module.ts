import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AuthGuard } from './guards/auth.guard';
import { RedisService } from './services/redis.service';
import { JwksService } from './services/jwks.service';
import { KeycloakClient } from './services/keycloak-client';
import { AuthService } from './services/auth.service';
import { HttpClient } from './services/http-client';
import { TokenRefreshLock } from './shared/token-refresh-lock';

import { AuthController } from './controllers/auth.controller';
import { ProxyController } from './controllers/proxy.controller';
import { HealthController } from './controllers/health.controller';
import { BackchannelController } from './controllers/backchannel.controller';

import { SessionContextInterceptor } from './interceptors/session-context.interceptor';
import { CsrfMiddleware } from './middleware/csrf.middleware';

@Module({
  imports: [
    TerminusModule,
  ],
  controllers: [AuthController, ProxyController, HealthController, BackchannelController],
  providers: [
    RedisService,
    JwksService,
    KeycloakClient,
    AuthService,
    HttpClient,
    TokenRefreshLock,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: SessionContextInterceptor },
  ],
  exports: [RedisService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
