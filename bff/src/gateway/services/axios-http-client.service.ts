import { Injectable, UnauthorizedException } from '@nestjs/common';
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { AuthService } from '../../auth/services/auth.service';
import { TokenRefreshLock } from '../../session/services/token-refresh-lock.service';
import { SessionService } from '../../session/services/session.service';
import { Logger } from '../../shared/logger/logger';
import { assertAuthenticated } from '../../shared/utils/assert-authenticated';
import type { AuthSession } from '../../types/session';

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

@Injectable()
export class AxiosHttpClient {
  readonly client: AxiosInstance;

  constructor(
    private authService: AuthService,
    private refreshLock: TokenRefreshLock,
    private sessions: SessionService,
  ) {
    this.client = axios.create();
    this.client.interceptors.request.use((cfg) => this.attachToken(cfg));
    this.client.interceptors.response.use(
      (res) => res,
      (err) => this.handleResponseError(err),
    );
  }

  private attachToken(cfg: InternalAxiosRequestConfig) {
    const token = this.sessions.get()?.accessToken;
    const ses = this.sessions.get();
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  }

  private async handleResponseError(error: AxiosError) {
    try {
      await this.refreshTokens(error);
      return this.client(error.config as RetryableConfig);
    } catch (err) {
      if (this.isInvalidGrant(err)) {
        Logger.error('HttpClient', 'invalid_grant — session destroyed');
        const session = this.sessions.get();
        if (session) await this.sessions.destroy(session);
        throw new UnauthorizedException('Session expired');
      }
      throw error;
    }
  }

  private async refreshTokens(error: AxiosError) {
    if (error.response?.status !== 401) throw error;

    const session = this.sessions.get();
    if (!session?.id) throw error;

    const reqCfg = error.config as RetryableConfig;
    if (reqCfg._retry) throw error;
    reqCfg._retry = true;

    const acquired = await this.refreshLock.acquire(session.id);

    if (!acquired) {
      await this.refreshLock.waitAndRetry(session.id);
      await this.sessions.reload(session);
      assertAuthenticated(session);
      this.applyToken(session, reqCfg);
      return;
    }

    try {
      Logger.warn('HttpClient', '401 — refreshing token', { url: reqCfg.url });
      await this.authService.refreshTokens(session);
      await this.sessions.save(session);
      assertAuthenticated(session);
      this.applyToken(session, reqCfg);
      Logger.info('HttpClient', 'Token refreshed, retrying', { url: reqCfg.url });
    } finally {
      await this.refreshLock.release(session.id);
    }
  }

  private isInvalidGrant(error: unknown): boolean {
    const e = error as Record<string, unknown>;
    const response = e?.response as Record<string, unknown> | undefined;
    const data = response?.data as Record<string, unknown> | undefined;
    return response?.status === 400 && data?.error === 'invalid_grant';
  }

  private applyToken(session: AuthSession, reqCfg: RetryableConfig) {
    if (!reqCfg.headers) reqCfg.headers = {} as any;
    reqCfg.headers.Authorization = `Bearer ${session.accessToken}`;
  }
}
