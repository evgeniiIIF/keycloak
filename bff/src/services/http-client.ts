import { Injectable, UnauthorizedException } from '@nestjs/common';
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { requestContext } from '../shared/request-context';
import { AuthService } from './auth.service';
import { TokenRefreshLock } from '../shared/token-refresh-lock';
import { Logger } from '../shared/logger';
import { errorMessage } from '../shared/utils';

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
}

@Injectable()
export class HttpClient {
  private readonly instance: AxiosInstance;

  constructor(
    private authService: AuthService,
    private refreshLock: TokenRefreshLock,
  ) {
    this.instance = axios.create();
    this.instance.interceptors.request.use((cfg) => this.onRequest(cfg));
    this.instance.interceptors.response.use(
      (res) => res,
      (err) => this.onResponseError(err),
    );
  }

  async get<T, P>(url: string, params?: P): Promise<T> {
    const res = await this.instance.get<T>(url, { params });
    return res.data;
  }

  async post<T, D>(url: string, data?: D): Promise<T> {
    const res = await this.instance.post<T>(url, data);
    return res.data;
  }

  async put<T, D>(url: string, data?: D): Promise<T> {
    const res = await this.instance.put<T>(url, data);
    return res.data;
  }

  async delete<T>(url: string): Promise<T> {
    const res = await this.instance.delete<T>(url);
    return res.data;
  }

  async patch<T, D>(url: string, data?: D): Promise<T> {
    const res = await this.instance.patch<T>(url, data);
    return res.data;
  }

  private async onRequest(cfg: InternalAxiosRequestConfig) {
    const ctx = requestContext.getStore();
    if (ctx?.req?.session?.accessToken) {
      cfg.headers.Authorization = `Bearer ${ctx.req.session.accessToken}`;
    }
    return cfg;
  }

  private async onResponseError(error: AxiosError) {
    const reqCfg = error.config as RetryableConfig | undefined;

    if (error.response?.status === 401 && reqCfg && !reqCfg._retry) {
      return this.handle401(error, reqCfg);
    }

    throw error;
  }

  private async handle401(error: AxiosError, reqCfg: RetryableConfig) {
    const ctx = requestContext.getStore();
    const session = ctx?.req?.session;

    if (!session?.refreshToken) throw error;

    const sessionId = session.id;
    if (!sessionId) throw error;

    reqCfg._retry = true;
    reqCfg._retryCount = (reqCfg._retryCount || 0) + 1;

    if (reqCfg._retryCount > 2) {
      throw error;
    }

    const acquired = await this.refreshLock.acquire(sessionId);
    if (!acquired) {
      Logger.warn('HttpClient', '401 — another refresh in progress, waiting', { url: reqCfg.url });
      await this.refreshLock.waitAndRetry(sessionId);

      await new Promise<void>((resolve, reject) => {
        session.reload((err) => (err ? reject(err) : resolve()));
      });

      reqCfg.headers.Authorization = `Bearer ${session.accessToken}`;
      return this.instance(reqCfg);
    }

    Logger.warn('HttpClient', '401 — refreshing token', { url: reqCfg.url });

    try {
      await this.authService.refreshTokens(session);

      await new Promise<void>((resolve, reject) => {
        session.save((err) => (err ? reject(err) : resolve()));
      });

      reqCfg.headers.Authorization = `Bearer ${session.accessToken}`;
      Logger.info('HttpClient', 'Token refreshed, retrying', { url: reqCfg.url });

      return this.instance(reqCfg);
    } catch (refreshErr: unknown) {
      const isInvalidGrant =
        refreshErr instanceof AxiosError &&
        refreshErr.response?.status === 400 &&
        refreshErr.response?.data?.error === 'invalid_grant';

      if (isInvalidGrant) {
        const data = (refreshErr as any).response?.data || {};
        Logger.error('HttpClient', 'invalid_grant — session destroyed', {
          status: String(refreshErr.response?.status),
          error: data.error,
          description: data.error_description || undefined,
        });
        await new Promise<void>((resolve, reject) => {
          session.destroy((e) => (e ? reject(e) : resolve()));
        });
        throw new UnauthorizedException('Session expired');
      }

      Logger.error('HttpClient', `Refresh failed: ${errorMessage(refreshErr)}`);
      throw refreshErr;
    } finally {
      await this.refreshLock.release(sessionId);
    }
  }
}