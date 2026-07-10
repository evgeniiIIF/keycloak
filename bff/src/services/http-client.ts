import { Injectable, UnauthorizedException } from '@nestjs/common';
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { requestContext } from '../shared/request-context';
import { AuthService } from './auth.service';
import { Logger } from '../shared/logger';
import { errorMessage } from '../shared/utils';
import { isRefreshing, startRefresh } from '../shared/token-refresh-lock';

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

@Injectable()
export class HttpClient {
  private readonly instance: AxiosInstance;

  constructor(private authService: AuthService) {
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
    if (ctx?.session?.accessToken) {
      cfg.headers.Authorization = `Bearer ${ctx.session.accessToken}`;
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
    const session = ctx?.session;

    if (!session?.refreshToken) throw error;

    const sessionId = session.id;
    if (!sessionId) throw error;

    reqCfg._retry = true;

    const existingRefresh = isRefreshing(sessionId);
    if (existingRefresh) {
      Logger.warn('HttpClient', '401 — another refresh in progress, waiting', { url: reqCfg.url });
      await existingRefresh;

      await new Promise<void>((resolve, reject) => {
        session.reload((err) => (err ? reject(err) : resolve()));
      });

      reqCfg.headers.Authorization = `Bearer ${session.accessToken}`;
      return this.instance(reqCfg);
    }

    Logger.warn('HttpClient', '401 — refreshing token', { url: reqCfg.url });

    const { release } = startRefresh(sessionId);
    try {
      await this.authService.refreshTokens(session);

      reqCfg.headers.Authorization = `Bearer ${session.accessToken}`;
      Logger.info('HttpClient', 'Token refreshed, retrying', { url: reqCfg.url });

      return this.instance(reqCfg);
    } catch (refreshErr: unknown) {
      const err = refreshErr as AxiosError<{ error?: string; error_description?: string }>;
      const isInvalidGrant =
        err.response?.status === 400 &&
        err.response?.data?.error === 'invalid_grant';

      if (isInvalidGrant) {
        // Уничтожаем сессию, чтобы не оставлять мусор
        await new Promise<void>((resolve, reject) => {
          session.destroy((e) => (e ? reject(e) : resolve()));
        });

        Logger.error('HttpClient', 'Refresh rejected — session destroyed');
        throw new UnauthorizedException('Session expired');
      }

      Logger.error('HttpClient', `Refresh failed: ${errorMessage(refreshErr)}`);
      throw refreshErr;
    } finally {
      release();
    }
  }
}