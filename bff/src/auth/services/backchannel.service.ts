import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JWTPayload,jwtVerify } from 'jose';

import { config } from '../../config/config';
import { RedisKeys } from '../../redis/constants/redis-key-prefixes';
import { RedisService } from '../../redis/services/redis.service';
import { SessionService } from '../../session/services/session.service';
import { Logger } from '../../shared/logger/logger';
import { JwksService } from './jwks.service';

// Явный интерфейс для Payload события Backchannel Logout
interface BackchannelLogoutPayload extends JWTPayload {
  events: {
    'http://schemas.openid.net/event/backchannel-logout'?: unknown;
  };
}

@Injectable()
export class BackchannelService {
  constructor(
    private readonly jwksService: JwksService,
    private readonly redisService: RedisService,
    private readonly sessionService: SessionService,
  ) {}

  async handleBackchannelLogout(logoutToken: string): Promise<void> {
    const payload = await this.verifyLogoutToken(logoutToken); // верифицируем токен
    await this.checkReplay(payload.jti);                      // проверяем на replay
    const sub = this.validateSubClaim(payload);               // достаем sub или кидает ошибку
    await this.destroyUserSessions(sub);                      // удаляем сессии
  }

  private async verifyLogoutToken(logoutToken: string): Promise<BackchannelLogoutPayload> {
    const { payload } = await jwtVerify(logoutToken, this.jwksService.getJWKS(), {
      issuer: config.keycloak.publicIssuer,
      audience: config.keycloak.clientId,
    });

    const logoutPayload = payload as BackchannelLogoutPayload;
    if (!logoutPayload.events?.['http://schemas.openid.net/event/backchannel-logout']) {
      throw new UnauthorizedException('Missing backchannel-logout event');
    }

    return logoutPayload;
  }

  private async checkReplay(jti: string | undefined): Promise<void> {
    if (!jti) return;

    const key = RedisKeys.replay(jti);
    const exists = await this.redisService.client.exists(key);
    if (exists) {
      Logger.warn('Auth', 'Backchannel logout replay', { jti });
      throw new UnauthorizedException('Replay detected');
    }

    const ttl = 300;
    await this.redisService.client.set(key, '1', { EX: ttl });
  }

  private validateSubClaim(payload: BackchannelLogoutPayload): string {
    if (!payload.sub) {
      throw new BadRequestException('Missing sub claim');
    }
    return payload.sub;
  }

  private async destroyUserSessions(sub: string): Promise<void> {
    Logger.info('Auth', 'Backchannel logout', { sub });
    await this.sessionService.destroyAllSessions(sub);
  }
}
