import { Injectable, BadRequestException } from '@nestjs/common';
import { decodeJwt } from 'jose';
import * as crypto from 'crypto';
import { config } from '../../config/config';
import { RedisService } from '../../redis/services/redis.service';
import { SessionService } from '../../session/services/session.service';
import { KeycloakClient } from './keycloak.service';
import { Logger } from '../../shared/logger/logger';
import { errorMessage } from '../../shared/utils/utils';
import { KeycloakJwtPayload } from '../../types/keycloak';
import type { Session, SessionTokens } from '../../types/session';

@Injectable()
export class AuthService {
  constructor(
    private readonly redis: RedisService,
    private readonly keycloak: KeycloakClient,
    private readonly sessionService: SessionService,
  ) {}

  async buildAuthorizationUrl(): Promise<string> {
    const codeVerifier = crypto.randomBytes(32).toString('hex');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest()
      .toString('base64url');
    const state = crypto.randomBytes(16).toString('hex');
    await this.redis.setOAuthState(state, codeVerifier);

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

  async exchangeCode(code: string, state: string): Promise<string> {
    const codeVerifier = await this.redis.getOAuthState(state);
    if (!codeVerifier) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const tokenSet = await this.keycloak.exchangeCode(code, codeVerifier);
    const idPayload = decodeJwt<KeycloakJwtPayload>(tokenSet.id_token);
    
    const session = await this.sessionService.create(idPayload, tokenSet, idPayload.sub);
    await this.redis.deleteOAuthState(state);

    Logger.info('Auth', 'Login complete', {
      user: session.user.username || session.user.email,
    });
    return session.id;
  }

  async logout(session: Session): Promise<string> {
    const idToken = session.tokens.idToken;
    const refreshToken = session.tokens.refreshToken;

    await this.sessionService.destroy(session.id, session.user.id).catch((err: unknown) => {
      Logger.error('AuthService', `Session destroy error: ${errorMessage(err)}`);
    });

    try {
      await this.keycloak.revokeRefreshToken(refreshToken);
    } catch (err: unknown) {
      Logger.warn('AuthService', `Failed to revoke refresh token: ${errorMessage(err)}`);
    }

    return this.buildLogoutUrl(idToken);
  }

  async refreshTokens(sessionId: string, currentTokens: SessionTokens): Promise<SessionTokens> {
    const tokenSet = await this.keycloak.refreshTokens(currentTokens.refreshToken);
    const newTokens: SessionTokens = {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token || currentTokens.refreshToken,
      idToken: tokenSet.id_token,
    };
    await this.sessionService.updateTokens(sessionId, newTokens);
    return newTokens;
  }

  private buildLogoutUrl(idToken: string): string {
    const url = new URL(`${config.keycloak.publicIssuer}/protocol/openid-connect/logout`);
    url.searchParams.append('id_token_hint', idToken);
    url.searchParams.append('post_logout_redirect_uri', config.keycloak.logoutRedirectUri);
    return url.toString();
  }
}
