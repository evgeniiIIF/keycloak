import { Injectable, UnauthorizedException } from '@nestjs/common';
import { oidcConfig } from '@configs/oidc.config';
import { config } from '@configs/configuration';
import { SessionService, sessionService } from './session.service';
import { redisClient } from '@configs/redis.config';
import axios from 'axios';
import * as crypto from 'crypto';
import * as querystring from 'querystring';
import { Logger } from '../utils/logger';

@Injectable()
export class AuthService {
  constructor(private sessionService: SessionService) {}

  async getAuthorizationUrl() {
    const code_verifier = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(code_verifier).digest();
    const code_challenge = hash.toString('base64url');

    const state = crypto.randomBytes(16).toString('hex');
    await redisClient.set(`state:${state}`, code_verifier, 'EX', config.auth.stateTtl);
    Logger.info('AuthService', `Generated authorization URL`, { state: state.slice(0, 8) });

    const authEndpoint = `${oidcConfig.issuer}/protocol/openid-connect/auth`;
    const params = querystring.stringify({
      client_id: oidcConfig.clientId,
      response_type: 'code',
      redirect_uri: oidcConfig.redirectUri,
      scope: oidcConfig.scope,
      state,
      code_challenge,
      code_challenge_method: 'S256',
    });

    const url = `${authEndpoint}?${params}`;
    return { url, state };
  }

  async handleCallback(code: string, state: string) {
    const codeVerifier = await redisClient.get(`state:${state}`);
    if (!codeVerifier) {
      Logger.warn('AuthService', `Invalid or expired state`, { state: state.slice(0, 8) });
      throw new UnauthorizedException('Invalid or expired state');
    }
    await redisClient.del(`state:${state}`);
    Logger.info('AuthService', `Exchanging authorization code for tokens`, { state: state.slice(0, 8) });

    const postData = querystring.stringify({
      grant_type: 'authorization_code',
      client_id: oidcConfig.clientId,
      client_secret: oidcConfig.clientSecret,
      redirect_uri: oidcConfig.redirectUri,
      code,
      code_verifier: codeVerifier,
    });

    try {
      const { data: tokenSet } = await axios.post(
        `/realms/${config.keycloak.realm}/protocol/openid-connect/token`,
        postData,
        {
          baseURL: `http://${oidcConfig.hostname}:${oidcConfig.port}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const idTokenPayload = JSON.parse(Buffer.from(tokenSet.id_token.split('.')[1], 'base64').toString());
      const userInfo = {
        sub: idTokenPayload.sub,
        email: idTokenPayload.email,
        preferred_username: idTokenPayload.preferred_username,
        name: idTokenPayload.name,
      };
      Logger.info('AuthService', `Tokens received`, {
        user: userInfo.preferred_username || userInfo.email || userInfo.sub,
      });

      return this.sessionService.createSession(tokenSet, userInfo);
    } catch (error: any) {
      const status = error.response?.status || 'unknown';
      const kcError = error.response?.data?.error;
      Logger.error('AuthService', `Token request failed: ${status} ${kcError || error.message}`, {
        state: state.slice(0, 8),
      });
      throw new UnauthorizedException('Authentication failed');
    }
  }

  async refreshAccessToken(sessionId: string) {
    const sid = sessionId.slice(0, 8);
    const session = await this.sessionService.getSession(sessionId);
    if (!session || !session.refreshToken) {
      Logger.warn('AuthService', `No refresh token available`, {
        session: sid,
        reason: !session ? 'session not found' : 'refresh token is null',
      });
      throw new UnauthorizedException('No refresh token available');
    }

    Logger.info('AuthService', `Refreshing access token`, { session: sid });

    const postData = querystring.stringify({
      grant_type: 'refresh_token',
      client_id: oidcConfig.clientId,
      client_secret: oidcConfig.clientSecret,
      refresh_token: session.refreshToken,
    });

    try {
      const { data: tokenSet } = await axios.post(
        `/realms/${config.keycloak.realm}/protocol/openid-connect/token`,
        postData,
        {
          baseURL: `http://${oidcConfig.hostname}:${oidcConfig.port}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      await this.sessionService.updateTokens(sessionId, {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
      });

      const decoded = this.decodeToken(tokenSet.access_token);
      const newExpiry = new Date(decoded.exp * 1000).toLocaleTimeString('en-GB', { hour12: false });
      const lifetimeSec = decoded.exp - Math.floor(Date.now() / 1000);

      Logger.info('AuthService', `Token refreshed`, {
        session: sid,
        expiry: newExpiry,
        lifetime: `${lifetimeSec}s`,
        user: decoded.preferred_username || decoded.email || decoded.sub,
      });
      return tokenSet.access_token;
    } catch (error: any) {
      const status = error.response?.status || 'unknown';
      const kcError = error.response?.data?.error;
      const kcReason = error.response?.data?.error_description;
      const isInvalidGrant = status === 400 && kcError === 'invalid_grant';

      if (isInvalidGrant) {
        Logger.error('AuthService', `Refresh rejected by Keycloak: ${status} ${kcError}`, {
          session: sid,
          reason: kcReason || 'Token is not active',
        });
        throw error;
      }

      Logger.error('AuthService', `Token refresh failed: ${status} ${error.message}`, { session: sid });
      throw new UnauthorizedException('Token refresh failed');
    }
  }

  getLogoutUrl(idToken: string): string {
    const logoutUrl = new URL(`${oidcConfig.issuer}/protocol/openid-connect/logout`);
    logoutUrl.searchParams.append('id_token_hint', idToken);
    logoutUrl.searchParams.append('post_logout_redirect_uri', `${config.frontendUrl}/home`);
    return logoutUrl.toString();
  }

  private decodeToken(token: string): any {
    const parts = token.split('.');
    return JSON.parse(Buffer.from(parts[1], 'base64').toString());
  }
}

export const authService = new AuthService(sessionService);
