import { Injectable, UnauthorizedException } from '@nestjs/common';
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { AuthService } from './auth.service';
import { TokenRefreshLock } from '../shared/token-refresh-lock';
import { SessionService } from '../shared/session.service';
import { Logger } from '../shared/logger';
import { errorMessage } from '../shared/utils';
import { BffSession } from '../types/session';

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

  // ─── Level 1: Interceptors ───────────────────────────────────────

  private attachToken(cfg: InternalAxiosRequestConfig) {
    const token = this.sessions.get()?.accessToken;
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  }

  private async handleResponseError(error: AxiosError) {
    try {
      await this.refreshTokens(error);
      return this.client(error.config as RetryableConfig);
    } catch (err) {
      await this.handleRefreshError(err);
      throw err;
    }
  }

  // ─── Level 2: Orchestration ──────────────────────────────────────

  private async refreshTokens(error: AxiosError) {
    if (!this.canRetry(error)) throw error;

    const session = this.sessions.get();
    if (!session?.id) throw error;

    const reqCfg = error.config as RetryableConfig;
    reqCfg._retry = true;

    const acquired = await this.refreshLock.acquire(session.id);

    if (!acquired) {
      await this.waitForLockAndRetry(session, reqCfg);
      return;
    }

    try {
      await this.doRefresh(session, reqCfg);
    } finally {
      await this.refreshLock.release(session.id);
    }
  }

  private async doRefresh(session: BffSession, reqCfg: RetryableConfig) {
    Logger.warn('HttpClient', '401 — refreshing token', { url: reqCfg.url });
    await this.authService.refreshTokens(session);
    await this.sessions.save(session);
    this.applyToken(session, reqCfg);
    Logger.info('HttpClient', 'Token refreshed, retrying', { url: reqCfg.url });
  }

  private async waitForLockAndRetry(session: BffSession, reqCfg: RetryableConfig) {
    Logger.warn('HttpClient', '401 — another refresh in progress, waiting', { url: reqCfg.url });
    await this.refreshLock.waitAndRetry(session.id);
    await this.sessions.reload(session);
    this.applyToken(session, reqCfg);
  }

  private async handleRefreshError(err: unknown) {
    if (this.isInvalidGrant(err)) {
      Logger.error('HttpClient', 'invalid_grant — session destroyed');
      const session = this.sessions.get();
      if (session) await this.sessions.destroy(session);
      throw new UnauthorizedException('Session expired');
    }
    Logger.error('HttpClient', `Refresh failed: ${errorMessage(err)}`);
  }

  // ─── Level 3: Predicates & Helpers ───────────────────────────────

  private canRetry(error: AxiosError): boolean {
    const reqCfg = error.config as RetryableConfig | undefined;
    const session = this.sessions.get();
    return (
      error.response?.status === 401 &&
      !!reqCfg &&
      !reqCfg._retry &&
      !!session?.refreshToken &&
      !!session?.id
    );
  }

  private isInvalidGrant(error: any): boolean {
    return error?.response?.status === 400 && error?.response?.data?.error === 'invalid_grant';
  }

  private applyToken(session: BffSession, reqCfg: RetryableConfig) {
    if (session.accessToken) {
      if (!reqCfg.headers) reqCfg.headers = {} as any;
      reqCfg.headers.Authorization = `Bearer ${session.accessToken}`;
    }
  }
}
