import { BadRequestException,Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { Response } from 'express';
import { decodeJwt } from 'jose';

import { config } from '../../config/config';
import { RedisService } from '../../redis/services/redis.service';
import { SessionService } from '../../session/services/session.service';
import { Logger } from '../../shared/logger/logger';
import { errorMessage } from '../../shared/utils/utils';
import { KeycloakJwtPayload } from '../../types/keycloak';
import type { Session, SessionTokens } from '../../types/session';
import { KeycloakClient } from './keycloak.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly redis: RedisService,
    private readonly keycloak: KeycloakClient,
    private readonly sessionService: SessionService,
  ) {}

  // Создаем URL для авторизации в Keycloak
  async buildAuthorizationUrl(): Promise<string> {
    const { verifier, challenge } = this.generatePkce();       // генерируем PKCE пару
    const state = crypto.randomBytes(16).toString('hex');     // создаем state
    await this.redis.setOAuthState(state, verifier);          // сохраняем в Redis

    const params = new URLSearchParams({
      client_id: config.keycloak.clientId,
      response_type: 'code',
      redirect_uri: config.keycloak.redirectUri,
      scope: 'openid profile email',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return `${config.keycloak.publicIssuer}/protocol/openid-connect/auth?${params}`;
  }

  // Обмениваем authorization code на токены и создаем сессию
  async exchangeCode(code: string, state: string): Promise<string> {
    const codeVerifier = await this.redis.getOAuthState(state); // проверяем state в Redis
    if (!codeVerifier) {
      throw new BadRequestException('Invalid or expired OAuth state'); // бросаем ошибку если state невалиден
    }

    const tokenSet = await this.keycloak.exchangeCode(code, codeVerifier); // обмениваем код на токены
    const idTokenPayload = decodeJwt<KeycloakJwtPayload>(tokenSet.id_token);     // парсим ID токен

    const session = await this.sessionService.create(idTokenPayload, tokenSet, idTokenPayload.sub); // создаем сессию
    await this.redis.deleteOAuthState(state); // удаляем state после использования

    Logger.info('Auth', 'Login complete', {
      user: session.user.username || session.user.email,
    });
    return session.id;
  }

  // Завершаем сессию локально и в Keycloak
  async logout(session: Session): Promise<string> {
    const idToken = session.tokens.idToken;
    const refreshToken = session.tokens.refreshToken;

    await this.sessionService.destroy(session.id, session.user.id).catch((err: unknown) => {
      Logger.error('AuthService', `Session destroy error: ${errorMessage(err)}`);
    });

    try {
      await this.keycloak.revokeRefreshToken(refreshToken); // отзываем refresh token в Keycloak
    } catch (err: unknown) {
      Logger.warn('AuthService', `Failed to revoke refresh token: ${errorMessage(err)}`);
    }

    return this.buildLogoutUrl(idToken); // возвращаем URL для выхода из Keycloak
  }

  // Обновляем токены сессии через Keycloak
  async refreshTokens(sessionId: string, currentTokens: SessionTokens): Promise<SessionTokens> {
    const tokenSet = await this.keycloak.refreshTokens(currentTokens.refreshToken); // запрашиваем новые токены
    const newTokens: SessionTokens = {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token || currentTokens.refreshToken,
      idToken: tokenSet.id_token,
    };
    await this.sessionService.updateTokens(sessionId, newTokens); // сохраняем обновленные токены
    return newTokens;
  }

  // Устанавливаем сессионную куку в ответ
  async setSessionCookie(res: Response, sessionId: string) {
    res.cookie(config.session.cookieName, sessionId, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      maxAge: config.session.ttl * 1000,
      path: '/',
    });
  }

  // Очищаем сессионные куки в ответе
  clearSessionCookies(res: Response) {
    res.clearCookie(config.session.cookieName, {
      path: '/',
      sameSite: 'strict',
      secure: config.isProduction,
    });
    res.clearCookie('XSRF-TOKEN', { path: '/' });
  }

  // --- Примитивы ---

  private generatePkce() {
    const verifier = crypto.randomBytes(32).toString('hex');
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest()
      .toString('base64url');
    return { verifier, challenge };
  }

  private buildLogoutUrl(idToken: string): string {
    const url = new URL(`${config.keycloak.publicIssuer}/protocol/openid-connect/logout`);
    url.searchParams.append('id_token_hint', idToken);
    url.searchParams.append('post_logout_redirect_uri', config.keycloak.logoutRedirectUri);
    return url.toString();
  }
}
