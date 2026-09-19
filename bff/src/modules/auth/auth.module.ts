import { Module } from '@nestjs/common';

import { RedisModule } from '@/infra/redis/redis.module';
import { SessionModule } from '@/modules/sessions/session.module';

import { AuthController } from './controllers/auth.controller';
import { BackchannelController } from './controllers/backchannel.controller';
import { OAuthCallbackInterceptor } from './interceptors/oauth-callback.interceptor';
import { AuthService } from './services/auth.service';
import { BackchannelService } from './services/backchannel.service';
import { JwksService } from './services/jwks.service';
import { KeycloakClient } from './services/keycloak.service';
import { OAuthStateRepository } from './storage/oauth-state.repository';

// Домен «аутентификация»: OAuth flow, callback, backchannel logout.
// Отдаёт наружу AuthService — им пользуются GatewayModule и guards.
@Module({
  imports: [RedisModule, SessionModule],
  controllers: [AuthController, BackchannelController],
  providers: [
    OAuthStateRepository,
    AuthService,
    KeycloakClient,
    JwksService,
    BackchannelService,
    OAuthCallbackInterceptor,
  ],
  exports: [AuthService],
})
export class AuthModule {}
