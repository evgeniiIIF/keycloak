import { Injectable, UnauthorizedException } from '@nestjs/common';
import { oidcConfig } from '@configs/oidc.config';
import { SessionService } from './session.service';
import { redisClient } from '@configs/redis.config';
import * as crypto from 'crypto';
import * as http from 'http';
import * as querystring from 'querystring';

@Injectable()
export class AuthService {
  constructor(private sessionService: SessionService) {}

  async getAuthorizationUrl() {
    const code_verifier = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(code_verifier).digest();
    const code_challenge = hash.toString('base64url');

    const state = crypto.randomBytes(16).toString('hex');
    await redisClient.set(`state:${state}`, code_verifier, 'EX', 300);

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

    const tokenResponse = await new Promise<string>((resolve, reject) => {
      const req = http.request({
        hostname: 'keycloak',
        port: 8080,
        path: '/realms/TestRealm/protocol/openid-connect/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Token endpoint returned ${res.statusCode}: ${body}`));
          } else {
            resolve(body);
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    const tokenSet = JSON.parse(tokenResponse);

    const idTokenPayload = JSON.parse(Buffer.from(tokenSet.id_token.split('.')[1], 'base64').toString());
    const userInfo = {
      sub: idTokenPayload.sub,
      email: idTokenPayload.email,
      preferred_username: idTokenPayload.preferred_username,
      name: idTokenPayload.name,
    };

    return this.sessionService.createSession(tokenSet, userInfo);
  }

  async refreshAccessToken(sessionId: string) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session || !session.refreshToken) {
      throw new UnauthorizedException('No refresh token available');
    }

    const postData = querystring.stringify({
      grant_type: 'refresh_token',
      client_id: oidcConfig.clientId,
      client_secret: oidcConfig.clientSecret,
      refresh_token: session.refreshToken,
    });

    const tokenResponse = await new Promise<string>((resolve, reject) => {
      const req = http.request({
        hostname: 'keycloak',
        port: 8080,
        path: '/realms/TestRealm/protocol/openid-connect/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Token endpoint returned ${res.statusCode}: ${body}`));
          } else {
            resolve(body);
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    const tokenSet = JSON.parse(tokenResponse);
    await this.sessionService.updateTokens(sessionId, {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
    });
    return tokenSet.access_token;
  }
}