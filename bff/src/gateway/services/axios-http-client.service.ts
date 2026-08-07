import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { Request } from 'express';
import { AuthService } from '../../auth/services/auth.service';
import { TokenRefreshLock } from '../../session/services/token-refresh-lock.service';
import { SessionService } from '../../session/services/session.service';
import { Logger } from '../../shared/logger/logger';
import { isKeycloakErrorBody } from '../../shared/utils/is-keycloak-error-body';

@Injectable()
export class AxiosHttpClient {
  readonly client: AxiosInstance;

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly authService: AuthService,
    private readonly refreshLock: TokenRefreshLock,
    private readonly sessionService: SessionService,
  ) {
    this.client = axios.create();
    this.client.interceptors.request.use((cfg) => this.attachToken(cfg));
    this.client.interceptors.response.use(
      (res) => res,
      (err) => this.handleResponseError(err),
    );
  }

  private attachToken(cfg: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    if (this.request.session) {
      cfg.headers.Authorization = `Bearer ${this.request.session.tokens.accessToken}`;
    }
    return cfg;
  }

  private async handleResponseError(error: AxiosError) {
    try {
      await this.refreshTokens(error);
      return await this.client(error.config as InternalAxiosRequestConfig);
    } catch (err) {
      if (this.isInvalidGrant(err)) {
        Logger.error('HttpClient', 'invalid_grant — destroying session');
        await this.destroySession();
        throw new UnauthorizedException('Session expired');
      }
      throw error;
    }
  }

  private async refreshTokens(error: AxiosError): Promise<void> {
    if (error.response?.status !== 401) throw error;
    if (!error.config || error.config._retry) throw error;

    const session = this.request.session;
    if (!session) throw error;

    error.config._retry = true;
    const reqCfg = error.config;

    const acquired = await this.refreshLock.acquire(session.id);
    if (!acquired) {
      await this.refreshLock.waitAndRetry(session.id);
      const updated = await this.sessionService.get(session.id);
      if (updated) {
        this.request.session = updated;
        this.applyToken(updated.tokens.accessToken, reqCfg);
      }
      return;
    }

    try {
      Logger.warn('HttpClient', '401 — refreshing token', { url: reqCfg.url });
      const newTokens = await this.authService.refreshTokens(session.id, session.tokens);
      this.request.session = { ...session, tokens: newTokens };
      this.applyToken(newTokens.accessToken, reqCfg);
      Logger.info('HttpClient', 'Token refreshed, retrying', { url: reqCfg.url });
    } finally {
      await this.refreshLock.release(session.id);
    }
  }

  private async destroySession(): Promise<void> {
    const session = this.request.session;
    if (session) {
      await this.sessionService.destroy(session.id, session.user.id);
    }
  }

  private isInvalidGrant(error: unknown): boolean {
    if (!(error instanceof AxiosError)) return false;
    if (error.response?.status !== 400) return false;
    const { data } = error.response;
    return isKeycloakErrorBody(data) && data.error === 'invalid_grant';
  }

  private applyToken(accessToken: string, reqCfg: InternalAxiosRequestConfig): void {
    reqCfg.headers.Authorization = `Bearer ${accessToken}`;
  }
}
