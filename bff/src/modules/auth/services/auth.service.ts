import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { Response } from 'express';
import { decodeJwt } from 'jose';

import { config } from '@/config/config';
import { SessionService } from '@/modules/sessions/services/session.service';
import { Logger } from '@/shared/logger/logger';
import { errorMessage } from '@/shared/utils/utils';

import { OAuthStateRepository } from '../storage/oauth-state.repository';
import { KeycloakJwtPayload } from '../types/keycloak';
import type { Session, SessionTokens } from '../types/session';
import { KeycloakClient } from './keycloak.service';

// OAuth 2.0 Authorization Code Flow с PKCE.
// Строит URL авторизации, обменивает код на токены, создаёт/уничтожает сессию,
// обновляет токены через refresh_token.
@Injectable()
export class AuthService {
  constructor(
    private readonly oauthState: OAuthStateRepository,
    private readonly keycloak: KeycloakClient,
    private readonly sessionService: SessionService,
  ) {}

  // Строим URL для редиректа на Keycloak.
  // Генерируем PKCE пару и state, сохраняем verifier в Redis под state.
  async buildAuthorizationUrl(): Promise<string> {
    const { verifier, challenge } = this.generatePkce();      // генерируем PKCE пару
    const state = this.generateState();                        // генерируем CSRF state
    await this.oauthState.save(state, verifier);               // сохраняем verifier под state
    return this.buildKeycloakAuthUrl(state, challenge);        // собираем URL авторизации
  }

  // Обмениваем authorization code на токены и создаём сессию
  async exchangeCode(code: string, state: string): Promise<Session> {
    const codeVerifier = await this.oauthState.find(state);    // достаём verifier по state
    if (!codeVerifier) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const tokenSet = await this.keycloak.exchangeCode(code, codeVerifier);  // обмениваем код на токены
    const idTokenPayload = this.decodeIdToken(tokenSet.id_token);            // парсим id_token
    const session = await this.sessionService.create(idTokenPayload, tokenSet, idTokenPayload.sub);  // создаём сессию
    await this.oauthState.delete(state);                                     // удаляем использованный state

    Logger.info('Auth', 'Login complete', {
      user: session.user.username || session.user.email,
    });
    return session;
  }

  // Завершаем сессию локально и в Keycloak, возвращаем URL выхода
  async logout(session: Session): Promise<string> {
    await this.destroySessionSafely(session);                  // удаляем сессию, ошибки логируем
    await this.revokeRefreshTokenSafely(session.tokens.refreshToken);  // отзываем в Keycloak, ошибки логируем
    return this.buildLogoutUrl(session.tokens.idToken);        // собираем URL выхода
  }

  // Обновляем токены сессии через Keycloak и сохраняем в Redis
  async refreshTokens(sessionId: string, currentTokens: SessionTokens): Promise<SessionTokens> {
    const tokenSet = await this.keycloak.refreshTokens(currentTokens.refreshToken);  // запрашиваем новые токены
    const newTokens = this.buildRefreshedTokens(tokenSet, currentTokens);            // собираем новые токены
    await this.sessionService.updateTokens(sessionId, newTokens);                    // сохраняем в сессию
    return newTokens;
  }

  // Устанавливаем сессионную и CSRF куки в ответ
  async setSessionCookies(res: Response, session: Session): Promise<void> {
    this.setHttpOnlyCookie(res, config.session.cookieName, session.id);  // httpOnly сессия
    this.setCsrfCookie(res, session.csrfToken);                           // читаемая CSRF кука
  }

  // Очищаем сессионные куки в ответе
  clearSessionCookies(res: Response): void {
    this.clearCookie(res, config.session.cookieName);
    this.clearCookie(res, 'XSRF-TOKEN');
  }

  // Сравниваем CSRF-токен из заголовка с токеном сессии.
  // timingSafeEqual защищает от timing-атак.
  validateCsrfToken(session: Session, csrfToken: string | undefined): boolean {
    if (!csrfToken) return false;
    const sessionBuf = Buffer.from(session.csrfToken);
    const tokenBuf = Buffer.from(csrfToken);
    if (sessionBuf.length !== tokenBuf.length) return false;
    return crypto.timingSafeEqual(sessionBuf, tokenBuf);
  }

  // ── Примитивы: URL ─────────────────────────────────────────────

  // Собираем URL авторизации Keycloak со всеми OAuth-параметрами
  private buildKeycloakAuthUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: config.keycloak.clientId,
      response_type: 'code',
      redirect_uri: config.keycloak.redirectUri,
      scope: 'openid profile email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${config.keycloak.publicIssuer}/protocol/openid-connect/auth?${params}`;
  }

  // Собираем URL выхода из Keycloak с hint на id_token
  private buildLogoutUrl(idToken: string): string {
    const url = new URL(`${config.keycloak.publicIssuer}/protocol/openid-connect/logout`);
    url.searchParams.append('id_token_hint', idToken);
    url.searchParams.append('post_logout_redirect_uri', config.keycloak.logoutRedirectUri);
    return url.toString();
  }

  // ── Примитивы: криптография ────────────────────────────────────

  // Генерируем PKCE пару: verifier + S256 challenge
  private generatePkce(): PkcePair {
    const verifier = crypto.randomBytes(32).toString('hex');
    const challenge = crypto.createHash('sha256').update(verifier).digest().toString('base64url');
    return { verifier, challenge };
  }

  // Генерируем случайный state для CSRF-защиты OAuth
  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // ── Примитивы: токены ──────────────────────────────────────────

  // Парсим id_token в типизированный payload
  private decodeIdToken(idToken: string): KeycloakJwtPayload {
    return decodeJwt<KeycloakJwtPayload>(idToken);
  }

  // Собираем обновлённые токены: используем старый refresh, если Keycloak не вернул новый
  private buildRefreshedTokens(
    tokenSet: { access_token: string; refresh_token?: string; id_token: string },
    currentTokens: SessionTokens,
  ): SessionTokens {
    return {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token || currentTokens.refreshToken,
      idToken: tokenSet.id_token,
    };
  }

  // ── Примитивы: безопасные операции ─────────────────────────────

  // Удаляем сессию, не пробрасывая ошибки наружу
  private async destroySessionSafely(session: Session): Promise<void> {
    try {
      await this.sessionService.destroy(session.id, session.user.id);
    } catch (err) {
      Logger.error('AuthService', `Session destroy error: ${errorMessage(err)}`);
    }
  }

  // Отзываем refresh_token в Keycloak, не пробрасывая ошибки наружу
  private async revokeRefreshTokenSafely(refreshToken: string): Promise<void> {
    try {
      await this.keycloak.revokeRefreshToken(refreshToken);
    } catch (err) {
      Logger.warn('AuthService', `Failed to revoke refresh token: ${errorMessage(err)}`);
    }
  }

  // ── Примитивы: cookies ─────────────────────────────────────────

  // Ставим httpOnly куку с сессией
  private setHttpOnlyCookie(res: Response, name: string, value: string): void {
    res.cookie(name, value, this.cookieOptions(true));
  }

  // Ставим читаемую из JS CSRF куку (double-submit pattern)
  private setCsrfCookie(res: Response, csrfToken: string): void {
    res.cookie('XSRF-TOKEN', csrfToken, this.cookieOptions(false));
  }

  // Удаляем куку по имени с теми же опциями безопасности
  private clearCookie(res: Response, name: string): void {
    res.clearCookie(name, this.cookieOptions(true));
  }

  // Общие опции cookie для сессии и CSRF
  private cookieOptions(httpOnly: boolean) {
    return {
      httpOnly,
      secure: config.isProduction,
      sameSite: 'strict' as const,
      maxAge: config.session.ttl * 1000,
      path: '/',
    };
  }
}

// PKCE пара: verifier (секрет) + challenge (публичный)
export interface PkcePair {
  verifier: string;
  challenge: string;
}
