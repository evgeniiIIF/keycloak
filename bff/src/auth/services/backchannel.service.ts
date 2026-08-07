import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { jwtVerify, JWTPayload } from 'jose';
import { config } from '../../config/config';
import { JwksService } from './jwks.service';
import { RedisService } from '../../redis/services/redis.service';
import { SessionService } from '../../session/services/session.service';
import { Logger } from '../../shared/logger/logger';
import { RedisKeys } from '../../redis/constants/redis-key-prefixes';

@Injectable()
export class BackchannelService {
  constructor(
    private readonly jwksService: JwksService,
    private readonly redisService: RedisService,
    private readonly sessionService: SessionService,
  ) {}

  async handleBackchannelLogout(logoutToken: string): Promise<void> {
    const payload = await this.verifyLogoutToken(logoutToken);
    await this.checkReplay(payload.jti);
    const sub = this.validateSubClaim(payload);
    await this.destroyUserSessions(sub);
  }

  private async verifyLogoutToken(logoutToken: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(logoutToken, this.jwksService.getJWKS(), {
      issuer: config.keycloak.publicIssuer,
      audience: config.keycloak.clientId,
    });

    const events = payload.events as Record<string, unknown> | undefined;
    if (!events?.['http://schemas.openid.net/event/backchannel-logout']) {
      throw new UnauthorizedException('Missing backchannel-logout event');
    }

    return payload;
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

  private validateSubClaim(payload: JWTPayload): string {
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
