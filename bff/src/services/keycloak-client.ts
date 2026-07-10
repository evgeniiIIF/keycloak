import { Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { config } from '../config/config';
import { Logger } from '../shared/logger';
import { errorMessage } from '../shared/utils';
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
    try {
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
    } catch (err: unknown) {
      const error = err as AxiosError<{ error?: string }>;
      const status = error.response?.status;
      const kcError = error.response?.data?.error;

      if (status === 400 && kcError === 'invalid_grant') {
        throw err;
      }

      Logger.error('KeycloakClient', `Refresh failed: ${status} ${kcError || errorMessage(err)}`);
      throw err;
    }
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      await axios.post(
        this.revokeEndpoint,
        new URLSearchParams({
          ...this.baseParams(),
          token: refreshToken,
          token_type_hint: 'refresh_token',
        }),
        { headers: FORM_HEADERS },
      );
    } catch (err: unknown) {
      Logger.warn('KeycloakClient', `Revoke failed: ${errorMessage(err)}`);
    }
  }
}
