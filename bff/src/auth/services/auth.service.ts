import { Injectable } from '@nestjs/common';
import { decodeJwt } from 'jose';
import * as crypto from 'crypto';
import { config } from '../../config/config';
import { RedisService } from '../../redis/services/redis.service';
import { SessionService } from '../../session/services/session.service';
import { KeycloakClient } from './keycloak.service';
import { Logger } from '../../shared/logger/logger';
import { errorMessage } from '../../shared/utils/utils';
import { KeycloakJwtPayload } from '../../types/keycloak';
import { assertAuthenticated } from '../../shared/utils/assert-authenticated';
import type { AuthSession } from '../../types/session';

@Injectable()
export class AuthService {
  constructor(
    private redis: RedisService,
    private keycloak: KeycloakClient,
    private sessionService: SessionService,
  ) {}

  // ── Login: OAuth state stored in Redis, keyed by state ──────────

  buildAuthorizationUrl(): string {
    const codeVerifier = crypto.randomBytes(32).toString('hex');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest()
      .toString('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    this.redis.setOAuthState(state, codeVerifier);

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

  // ── Callback: state из URL → Redis → codeVerifier → токены ─────

  async handleOAuthCallback(code: string, state: string, session: AuthSession): Promise<string> {
    return this.performLogin(code, state, session);
  }

  // ── Private: login ──────────────────────────────────────────────

  private async performLogin(code: string, state: string, session: AuthSession): Promise<string> {
    try {
      const codeVerifier = await this.redis.getOAuthState(state);
      if (!codeVerifier) {
        Logger.warn('Auth', 'Invalid or expired OAuth state');
        return `${config.frontendUrl}/login?error=invalid_state`;
      }

      const tokenSet = await this.keycloak.exchangeCode(code, codeVerifier);

      this.applyTokenSet(session, tokenSet);

      await this.redis.deleteOAuthState(state);
      await this.sessionService.save(session);
      await this.redis.addUserSession(session.userInfo.sub, session.id);

      this.logLogin(session);
      return `${config.frontendUrl}/`;
    } catch (err: unknown) {
      Logger.error('Auth', `Callback error: ${errorMessage(err)}`);
      return `${config.frontendUrl}/login?error=auth_failed`;
    }
  }

  private logLogin(session: AuthSession): void {
    Logger.info('Auth', 'Login complete', {
      user: session.userInfo?.preferred_username || session.userInfo?.email || '?',
    });
  }

  // ── Protected: session guaranteed to be full ────────────────────

  async performLogout(session: AuthSession): Promise<string> {
    await this.keycloak.revokeRefreshToken(session.refreshToken);
    await this.redis.removeUserSession(session.userInfo.sub, session.id);
    await this.sessionService.destroy(session).catch((err: unknown) => {
      Logger.error('AuthService', `Session destroy: ${errorMessage(err)}`);
    });
    return this.getLogoutUrl(session.idToken);
  }

  async refreshTokens(session: AuthSession): Promise<{ accessToken: string; refreshToken: string }> {
    const authSession = assertAuthenticated(session);

    const tokenSet = await this.keycloak.refreshTokens(authSession.refreshToken);
    this.applyTokenSet(authSession, tokenSet);

    await this.redis.refreshUserSessionTtl(authSession.userInfo.sub);
    await this.redis.refreshSessionStoreTtl(authSession.id);

    return { accessToken: authSession.accessToken, refreshToken: authSession.refreshToken };
  }

  // ── Utilities ───────────────────────────────────────────────────

  getLogoutUrl(idToken: string): string {
    const url = new URL(`${config.keycloak.publicIssuer}/protocol/openid-connect/logout`);
    url.searchParams.append('id_token_hint', idToken);
    url.searchParams.append('post_logout_redirect_uri', config.keycloak.logoutRedirectUri);
    return url.toString();
  }

  async destroyUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.redis.getUserSessions(userId);
    if (sessionIds.length === 0) return;

    await this.redis.deleteUserSessions(userId);
    Logger.info('AuthService', `Destroyed ${sessionIds.length} sessions for ${userId}`);
  }

  // ── Private: token application ──────────────────────────────────

  private applyTokenSet(
    session: AuthSession,
    tokenSet: { access_token: string; refresh_token: string; id_token?: string },
  ): void {
    this.sessionService.setTokens(session, tokenSet.access_token, tokenSet.refresh_token, tokenSet.id_token);

    if (tokenSet.id_token) {
      const idPayload = decodeJwt(tokenSet.id_token) as KeycloakJwtPayload;
      this.sessionService.setUserInfo(session, {
        sub: idPayload.sub!,
        email: idPayload.email,
        preferred_username: idPayload.preferred_username,
        name: idPayload.name,
      });
    }
  }
}
