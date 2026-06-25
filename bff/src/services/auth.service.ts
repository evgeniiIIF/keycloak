import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { oidcConfig } from '@configs/oidc.config';
import { config } from '@configs/configuration';
import { SessionService } from './session.service';
import { redisClient } from '@configs/redis.config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import * as querystring from 'querystring';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private sessionService: SessionService,
    private httpService: HttpService,
  ) {}

  async getAuthorizationUrl() {
    const code_verifier = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(code_verifier).digest();
    const code_challenge = hash.toString('base64url');

    const state = crypto.randomBytes(16).toString('hex');
    await redisClient.set(`state:${state}`, code_verifier, 'EX', config.auth.stateTtl);

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
      this.logger.warn(`Invalid or expired state: ${state}`);
      throw new UnauthorizedException('Invalid or expired state');
    }
    await redisClient.del(`state:${state}`);

    const postData = querystring.stringify({
      grant_type: 'authorization_code',
      client_id: oidcConfig.clientId,
      client_secret: oidcConfig.clientSecret,
      redirect_uri: oidcConfig.redirectUri,
      code,
      code_verifier: codeVerifier,
    });

    try {
      const { data: tokenSet } = await firstValueFrom(
        this.httpService.post(`/realms/${config.keycloak.realm}/protocol/openid-connect/token`, postData, {
          baseURL: `http://${oidcConfig.hostname}:${oidcConfig.port}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      const idTokenPayload = JSON.parse(Buffer.from(tokenSet.id_token.split('.')[1], 'base64').toString());
      const userInfo = {
        sub: idTokenPayload.sub,
        email: idTokenPayload.email,
        preferred_username: idTokenPayload.preferred_username,
        name: idTokenPayload.name,
      };

      return this.sessionService.createSession(tokenSet, userInfo);
    } catch (error) {
      this.logger.error(`Token request failed: ${error.message}`, error.stack);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  async refreshAccessToken(sessionId: string) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session || !session.refreshToken) {
      this.logger.warn(`No refresh token available for session: ${sessionId}`);
      throw new UnauthorizedException('No refresh token available');
    }

    this.logger.log(`🔄 Refreshing access token for session: ${sessionId}`);
    this.logger.log(
      `📅 Current token expires at: ${new Date(this.decodeToken(session.accessToken).exp * 1000).toISOString()}`,
    );

    const postData = querystring.stringify({
      grant_type: 'refresh_token',
      client_id: oidcConfig.clientId,
      client_secret: oidcConfig.clientSecret,
      refresh_token: session.refreshToken,
    });

    try {
      const { data: tokenSet } = await firstValueFrom(
        this.httpService.post(`/realms/${config.keycloak.realm}/protocol/openid-connect/token`, postData, {
          baseURL: `http://${oidcConfig.hostname}:${oidcConfig.port}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      await this.sessionService.updateTokens(sessionId, {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
      });

      this.logger.log(
        `✅ Token refreshed successfully. New token expires at: ${new Date(this.decodeToken(tokenSet.access_token).exp * 1000).toISOString()}`,
      );
      return tokenSet.access_token;
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`, error.stack);
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
