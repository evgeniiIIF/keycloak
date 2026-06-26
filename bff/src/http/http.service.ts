import { Injectable, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { SessionService } from '@services/session.service';
import { AuthService } from '@services/auth.service';
import { Logger } from '../utils/logger';

@Injectable()
export class HttpService implements OnModuleInit {
  private client: AxiosInstance;

  constructor(
    private sessionService: SessionService,
    private authService: AuthService,
  ) {
    this.client = axios.create();
  }

  onModuleInit() {
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const req = error.config;

        if (error.response?.status !== 401 || req._retry) {
          return Promise.reject(error);
        }

        const sessionId = req.headers['X-Session-ID'];
        if (!sessionId) {
          return Promise.reject(error);
        }

        req._retry = true;
        delete req.headers['X-Session-ID'];

        Logger.warn('HttpService', `401 from ${req.url}, refreshing token...`);

        try {
          const newToken = await this.authService.refreshAccessToken(sessionId);
          req.headers['Authorization'] = `Bearer ${newToken}`;

          Logger.info('HttpService', `Token refreshed, retrying...`);
          const response = await this.client.request(req);
          Logger.info('HttpService', `Retry OK: ${response.status}`);
          return response;
        } catch (refreshError: any) {
          Logger.error('HttpService', `Refresh failed: ${refreshError.message}, deleting session`);
          await this.sessionService.deleteSession(sessionId);
          throw new Error('Session expired');
        }
      }
    );

    Logger.info('HttpService', '401 interceptor registered');
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.request<T>(config);
  }
}
