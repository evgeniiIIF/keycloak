import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { BackchannelController } from './controllers/backchannel.controller';
import { AuthService } from './services/auth.service';
import { KeycloakClient } from './services/keycloak.service';
import { JwksService } from './services/jwks.service';
import { BackchannelService } from './services/backchannel.service';
import { OAuthCallbackInterceptor } from './interceptors/oauth-callback.interceptor';
import { RedisModule } from '../redis/redis.module';
import { SessionModule } from '../session/session.module';

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
