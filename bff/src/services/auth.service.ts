import { Injectable, UnauthorizedException } from '@nestjs/common';
import { decodeJwt } from 'jose';
import * as crypto from 'crypto';
import { config } from '../config/config';
import { RedisService } from './redis.service';
import { KeycloakClient } from './keycloak-client';
import { Logger } from '../shared/logger';
import { KeycloakJwtPayload } from '../types/keycloak';
import { BffSession } from '../types/session';

@Injectable()
export class AuthService {
  constructor(
    private redis: RedisService,
    private keycloak: KeycloakClient,
  ) {}

  buildAuthorizationUrl(session: BffSession): string {
    const codeVerifier = crypto.randomBytes(32).toString('hex');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest().toString('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    session.oauth = { state, codeVerifier };

    const params = new URLSearchParams({
      client_id: config.keycloak.clientId,
      response_type: 'code',
      redirect_uri: config.keycloak.redirectUri,
      scope: 'openid profile email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${config.keycloak.issuer}/protocol/openid-connect/auth?${params}`;
  }

  async handleCallback(code: string, state: string, session: BffSession): Promise<void> {
    if (!session.oauth) throw new UnauthorizedException('No pending auth');
    if (session.oauth.state !== state) throw new UnauthorizedException('State mismatch');

    const tokenSet = await this.keycloak.exchangeCode(code, session.oauth.codeVerifier);

    if (!tokenSet.id_token) throw new UnauthorizedException('Missing id_token');
    const idPayload = decodeJwt(tokenSet.id_token) as KeycloakJwtPayload;

    delete session.oauth;
    session.accessToken = tokenSet.access_token;
    session.refreshToken = tokenSet.refresh_token;
    session.idToken = tokenSet.id_token;
    session.userInfo = {
      sub: idPayload.sub!,
      email: idPayload.email,
      preferred_username: idPayload.preferred_username,
      name: idPayload.name,
    };

    await this.redis.addUserSession(session.userInfo.sub, session.id!);
  }

  async refreshTokens(session: BffSession): Promise<{ accessToken: string; refreshToken: string }> {
    if (!session.refreshToken) throw new UnauthorizedException('No refresh token');

    const tokenSet = await this.keycloak.refreshTokens(session.refreshToken);

    session.accessToken = tokenSet.access_token;
    session.refreshToken = tokenSet.refresh_token;
    if (tokenSet.id_token) session.idToken = tokenSet.id_token;

    if (session.userInfo?.sub) {
      await this.redis.refreshUserSessionTtl(session.userInfo.sub);
    }
    if (session.id) {
      await this.redis.refreshSessionStoreTtl(session.id);
    }

    return { accessToken: tokenSet.access_token, refreshToken: tokenSet.refresh_token };
  }

  getLogoutUrl(idToken: string): string {
    const url = new URL(`${config.keycloak.issuer}/protocol/openid-connect/logout`);
    url.searchParams.append('id_token_hint', idToken);
    url.searchParams.append('post_logout_redirect_uri', `${config.frontendUrl}/home`);
    return url.toString();
  }

  async unregisterSession(userId: string, sessionId: string): Promise<void> {
    await this.redis.removeUserSession(userId, sessionId);
  }

  async destroyUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.redis.getUserSessions(userId);
    if (sessionIds.length === 0) return;

    await this.redis.deleteUserSessions(userId);
    Logger.info('AuthService', `Destroyed ${sessionIds.length} sessions for ${userId}`);
  }
}
