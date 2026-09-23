import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JWTPayload, jwtVerify } from 'jose';

import { AppConfigService } from '@/config/app-config.service';
import { RedisClient } from '@/infra/redis/redis.client';
import { RedisKeys, RedisTtl } from '@/infra/redis/redis.keys';
import { SessionService } from '@/modules/sessions/services/session.service';
import { Logger } from '@/shared/logger/logger';

import { JwksService } from './jwks.service';

// URL-идентификатор события backchannel logout в OIDC-спеке
const BACKCHANNEL_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

// Явный интерфейс для payload logout token
interface BackchannelLogoutPayload extends JWTPayload {
  events: {
    'http://schemas.openid.net/event/backchannel-logout'?: unknown;
  };
}

// Обработка backchannel logout от Keycloak.
// Keycloak присылает подписанный logout_token, BFF верифицирует его,
// проверяет на replay и удаляет все сессии указанного пользователя.
@Injectable()
export class BackchannelService {
  constructor(
    private readonly config: AppConfigService,
    private readonly jwks: JwksService,
    private readonly redis: RedisClient,
    private readonly sessionService: SessionService,
  ) {}

  // Главный сценарий: верифицируем токен → защищаемся от replay → удаляем сессии
  async handleBackchannelLogout(logoutToken: string): Promise<void> {
    const payload = await this.verifyLogoutToken(logoutToken);   // верифицируем подпись и claims
    await this.checkReplay(payload.jti);                          // проверяем на повтор
    const sub = this.requireSubClaim(payload);                    // достаём sub или кидает ошибку
    await this.destroyUserSessions(sub);                          // удаляем все сессии пользователя
  }

  // ── Верификация токена ─────────────────────────────────────────

  // Верифицируем подпись и обязательные claims logout_token
  private async verifyLogoutToken(logoutToken: string): Promise<BackchannelLogoutPayload> {
    try {
      const { payload } = await jwtVerify(logoutToken, this.jwks.getJWKS(), {
        issuer: this.config.keycloak.publicIssuer,
        audience: this.config.keycloak.clientId,
      });
      const logoutPayload = payload as BackchannelLogoutPayload;
      this.requireBackchannelEvent(logoutPayload);                // проверяем наличие event
      return logoutPayload;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;        // нашу ошибку пробрасываем
      throw new UnauthorizedException('Invalid logout token');    // чужую маскируем
    }
  }

  // Проверяем, что в payload есть событие backchannel-logout
  private requireBackchannelEvent(payload: BackchannelLogoutPayload): void {
    if (!payload.events?.[BACKCHANNEL_EVENT]) {
      throw new UnauthorizedException('Missing backchannel-logout event');
    }
  }

  // Проверяем наличие sub, иначе logout token не адресный
  private requireSubClaim(payload: BackchannelLogoutPayload): string {
    if (!payload.sub) {
      throw new BadRequestException('Missing sub claim');
    }
    return payload.sub;
  }

  // ── Защита от replay ───────────────────────────────────────────

  // Проверяем jti на повтор и помечаем использованный
  private async checkReplay(jti: string | undefined): Promise<void> {
    if (!jti) return;                                             // без jti replay-защита невозможна
    if (await this.isReplayed(jti)) {                             // если уже видели
      Logger.warn('Auth', 'Backchannel logout replay', { jti });
      throw new UnauthorizedException('Replay detected');
    }
    await this.markAsSeen(jti);                                   // помечаем как использованный
  }

  // Смотрим, помечен ли jti как использованный
  private async isReplayed(jti: string): Promise<boolean> {
    return this.redis.exists(RedisKeys.replay(jti));
  }

  // Помечаем jti как использованный на время TTL
  private async markAsSeen(jti: string): Promise<void> {
    await this.redis.set(RedisKeys.replay(jti), '1', RedisTtl.replaySeconds);
  }

  // ── Удаление сессий ────────────────────────────────────────────

  // Удаляем все сессии пользователя по sub
  private async destroyUserSessions(sub: string): Promise<void> {
    Logger.info('Auth', 'Backchannel logout', { sub });
    await this.sessionService.destroyAllSessions(sub);
  }
}
