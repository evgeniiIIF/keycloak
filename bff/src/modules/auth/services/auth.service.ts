import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Response } from 'express';
import { JWTPayload,jwtVerify } from 'jose';

import { AppConfigService } from '@/config/app-config.service';
import { SessionService } from '@/modules/sessions/services/session.service';
import { AppLogger } from '@/shared/logger/app-logger.service';
import { errorMessage } from '@/shared/utils/utils';

import { OAuthState, OAuthStateRepository } from '../storage/oauth-state.repository';
import { KeycloakJwtPayload } from '../types/keycloak';
import type { Session, SessionTokens } from '../types/session';
import { JwksService } from './jwks.service';
import { KeycloakClient } from './keycloak.service';

// Разрешённый алгоритм подписи id_token. Keycloak в проде подписывает RS256;
// жёсткая фиксация защищает от alg-confusion атак (HS256 с публичным ключом).
const ID_TOKEN_ALGORITHMS = ['RS256'];

// OAuth 2.0 Authorization Code Flow с PKCE и OIDC nonce.
// Строит URL авторизации, верифицирует id_token, создаёт/уничтожает сессию,
// обновляет токены через refresh_token.
@Injectable()
export class AuthService {
  constructor(
    private readonly config: AppConfigService,
    private readonly oauthState: OAuthStateRepository,
    private readonly keycloak: KeycloakClient,
    private readonly jwks: JwksService,
    private readonly sessionService: SessionService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('AuthService');
  }

  // Строим URL редиректа на Keycloak.
  // Генерируем PKCE пару, state и nonce, сохраняем verifier+nonce под state.
  async buildAuthorizationUrl(): Promise<string> {
    const { verifier, challenge } = this.generatePkce();      // генерируем PKCE пару
    const state = this.generateRandomHex(16);                 // CSRF state
    const nonce = this.generateRandomHex(16);                 // OIDC nonce
    await this.oauthState.save(state, { codeVerifier: verifier, nonce });  // сохраняем в Redis
    return this.buildKeycloakAuthUrl(state, challenge, nonce); // собираем URL
  }

  // Обмениваем authorization code на токены, верифицируем id_token, создаём сессию
  async exchangeCode(code: string, state: string): Promise<Session> {
    const oauthState = await this.loadOAuthState(state);                              // { verifier, nonce }
    const tokenSet = await this.keycloak.exchangeCode(code, oauthState.codeVerifier); // обмен кода
    const idTokenPayload = await this.verifyIdToken(tokenSet.id_token, oauthState.nonce);  // верификация
    const session = await this.sessionService.create(idTokenPayload, tokenSet, idTokenPayload.sub);
    await this.oauthState.delete(state);                                              // state — one-time

    this.logger.info('Login complete', { user: session.user.username || session.user.email });
    return session;
  }

  // Завершаем сессию локально и в Keycloak, возвращаем URL выхода
  async logout(session: Session): Promise<string> {
    await this.destroySessionSafely(session);
    await this.revokeRefreshTokenSafely(session.tokens.refreshToken);
    return this.buildLogoutUrl(session.tokens.idToken);
  }

  // Обновляем токены сессии через Keycloak и сохраняем в Redis
  async refreshTokens(sessionId: string, currentTokens: SessionTokens): Promise<SessionTokens> {
    const tokenSet = await this.keycloak.refreshTokens(currentTokens.refreshToken);
    const newTokens = this.buildRefreshedTokens(tokenSet, currentTokens);
    await this.sessionService.updateTokens(sessionId, newTokens);
    return newTokens;
  }

  // Устанавливаем сессионную и CSRF куки в ответ
  async setSessionCookies(res: Response, session: Session): Promise<void> {
    this.setHttpOnlyCookie(res, this.config.session.cookieName, session.id);
    this.setCsrfCookie(res, session.csrfToken);
  }

  // Очищаем сессионные куки в ответе
  clearSessionCookies(res: Response): void {
    this.clearCookie(res, this.config.session.cookieName);
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

  // ── Верификация ────────────────────────────────────────────────

  // Достаём OAuth state из Redis или кидаем BadRequestException
  private async loadOAuthState(state: string): Promise<OAuthState> {
    const oauthState = await this.oauthState.find(state);
    if (!oauthState) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
    return oauthState;
  }

  // Верифицируем id_token через JWKS Keycloak: подпись, issuer, audience, nonce.
  // Возвращаем payload или кидаем UnauthorizedException.
  private async verifyIdToken(idToken: string, expectedNonce: string): Promise<KeycloakJwtPayload> {
    const payload = await this.verifySignature(idToken);
    if (payload.nonce !== expectedNonce) {
      throw new UnauthorizedException('Invalid id_token nonce');
    }
    return payload as KeycloakJwtPayload;
  }

  // Проверяем подпись, issuer, audience. Возвращаем payload или кидаем.
  private async verifySignature(idToken: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(idToken, this.jwks.getJWKS(), {
        issuer: this.config.keycloak.publicIssuer,
        audience: this.config.keycloak.clientId,
        algorithms: ID_TOKEN_ALGORITHMS,
      });
      return payload;
    } catch (err) {
      this.logger.warn(`id_token verification failed: ${errorMessage(err)}`);
      throw new UnauthorizedException('Invalid id_token');
    }
  }

  // ── Примитивы: URL ─────────────────────────────────────────────

  private buildKeycloakAuthUrl(state: string, codeChallenge: string, nonce: string): string {
    const params = new URLSearchParams({
      client_id: this.config.keycloak.clientId,
      response_type: 'code',
      redirect_uri: this.config.keycloak.redirectUri,
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${this.config.keycloak.publicIssuer}/protocol/openid-connect/auth?${params}`;
  }

  private buildLogoutUrl(idToken: string): string {
    const url = new URL(`${this.config.keycloak.publicIssuer}/protocol/openid-connect/logout`);
    url.searchParams.append('id_token_hint', idToken);
    url.searchParams.append('post_logout_redirect_uri', this.config.keycloak.logoutRedirectUri);
    return url.toString();
  }

  // ── Примитивы: криптография ────────────────────────────────────

  private generatePkce(): PkcePair {
    const verifier = crypto.randomBytes(32).toString('hex');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  private generateRandomHex(bytes: number): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  // ── Примитивы: токены ──────────────────────────────────────────

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

  private async destroySessionSafely(session: Session): Promise<void> {
    try {
      await this.sessionService.destroy(session.id, session.user.id);
    } catch (err) {
      this.logger.error(`Session destroy error: ${errorMessage(err)}`);
    }
  }

  private async revokeRefreshTokenSafely(refreshToken: string): Promise<void> {
    try {
      await this.keycloak.revokeRefreshToken(refreshToken);
    } catch (err) {
      this.logger.warn(`Failed to revoke refresh token: ${errorMessage(err)}`);
    }
  }

  // ── Примитивы: cookies ─────────────────────────────────────────

  private setHttpOnlyCookie(res: Response, name: string, value: string): void {
    res.cookie(name, value, this.cookieOptions(true));
  }

  private setCsrfCookie(res: Response, csrfToken: string): void {
    res.cookie('XSRF-TOKEN', csrfToken, this.cookieOptions(false));
  }

  private clearCookie(res: Response, name: string): void {
    res.clearCookie(name, this.cookieOptions(true));
  }

  private cookieOptions(httpOnly: boolean) {
    return {
      httpOnly,
      secure: this.config.isProduction,
      sameSite: 'strict' as const,
      maxAge: this.config.session.ttl * 1000,
      path: '/',
    };
  }
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}
