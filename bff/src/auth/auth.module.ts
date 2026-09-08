import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module';
import { SessionModule } from '../session/session.module';
import { AuthController } from './controllers/auth.controller';
import { BackchannelController } from './controllers/backchannel.controller';
import { OAuthCallbackInterceptor } from './interceptors/oauth-callback.interceptor';
import { AuthService } from './services/auth.service';
import { BackchannelService } from './services/backchannel.service';
import { JwksService } from './services/jwks.service';
import { KeycloakClient } from './services/keycloak.service';

@Module({
  imports: [RedisModule, SessionModule],
  controllers: [AuthController, BackchannelController],
  providers: [
    AuthService,
    KeycloakClient,
    JwksService,
    BackchannelService,
    OAuthCallbackInterceptor,
  ],
  exports: [AuthService],
})
export class AuthModule {}
