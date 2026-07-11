import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { config } from '../config/config';
import { TokenSet } from '../types/keycloak';

const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' } as const;

@Injectable()
export class KeycloakClient {
  private readonly tokenEndpoint = `${config.keycloak.issuer}/protocol/openid-connect/token`;
  private readonly revokeEndpoint = `${config.keycloak.issuer}/protocol/openid-connect/revoke`;

  private baseParams(): Record<string, string> {
    return {
      client_id: config.keycloak.clientId,
      client_secret: config.keycloak.clientSecret,
    };
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<TokenSet> {
    const { data } = await axios.post<TokenSet>(
      this.tokenEndpoint,
      new URLSearchParams({
        ...this.baseParams(),
        grant_type: 'authorization_code',
        redirect_uri: config.keycloak.redirectUri,
        code,
        code_verifier: codeVerifier,
      }),
      { headers: FORM_HEADERS },
    );
    return data;
  }

  async refreshTokens(refreshToken: string): Promise<TokenSet> {
    const { data } = await axios.post<TokenSet>(
      this.tokenEndpoint,
      new URLSearchParams({
        ...this.baseParams(),
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      { headers: FORM_HEADERS },
    );
    return data;
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await axios.post(
      this.revokeEndpoint,
      new URLSearchParams({
        ...this.baseParams(),
        token: refreshToken,
        token_type_hint: 'refresh_token',
      }),
      { headers: FORM_HEADERS },
    );
  }
}
