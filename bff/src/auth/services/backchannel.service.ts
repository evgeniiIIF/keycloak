import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { jwtVerify, JWTPayload } from 'jose';
import { config } from '../../config/config';
import { JwksService } from './jwks.service';
import { RedisService } from '../../redis/services/redis.service';
import { AuthService } from './auth.service';
import { Logger } from '../../shared/logger/logger';
import { RedisKeys } from '../../redis/constants/redis-key-prefixes';

@Injectable()
export class BackchannelService {
  constructor(
    private jwksService: JwksService,
    private redisService: RedisService,
    private authService: AuthService,
  ) {}

  // Обработка backchannel logout от Keycloak
  //   ├─ нет токена → 400
  //   ├─ невалидный JWT → 401/400
  //   └─ валидный → проверяем replay
  //                    ├─ replay → 401
  //                    └─ ок → валидируем sub
  //                              ├─ нет sub → 400
  //                              └─ есть → удаляем сессии
  async handleBackchannelLogout(logoutToken: string | undefined): Promise<void> {
    this.validateLogoutToken(logoutToken);                       // проверяем наличие токена или кидает ошибку
    const payload = await this.verifyLogoutToken(logoutToken);   // проверяем JWT или кидает ошибку
    await this.checkReplay(payload.jti);                         // проверяем Redis или кидает ошибку
    const sub = this.validateSubClaim(payload);                  // проверяем sub или кидает ошибку
    await this.destroyUserSessions(sub);                         // удаляем сессии
  }

  private validateLogoutToken(logoutToken: string | undefined): asserts logoutToken is string {
    if (!logoutToken) {
      throw new BadRequestException('Missing logout_token');
    }
  }

  // Проверяем JWT подпись, issuer, audience и событие backchannel-logout
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

  // Проверяем replay: если jti уже был — бросаем ошибку, нет — записываем в Redis
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

  // Валидируем sub: если нет — бросаем BadRequestException, есть — возвращаем строку
  private validateSubClaim(payload: JWTPayload): string {
    if (!payload.sub) {
      throw new BadRequestException('Missing sub claim');
    }
    return payload.sub;
  }

  // Удаляем все сессии пользователя через AuthService
  private async destroyUserSessions(sub: string): Promise<void> {
    Logger.info('Auth', 'Backchannel logout', { sub });
    await this.authService.destroyUserSessions(sub);
  }
}
