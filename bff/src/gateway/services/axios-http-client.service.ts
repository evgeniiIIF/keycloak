import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { Request } from 'express';
import { AuthService } from '../../auth/services/auth.service';
import { TokenRefreshLock } from '../../session/services/token-refresh-lock.service';
import { SessionService } from '../../session/services/session.service';
import { Logger } from '../../shared/logger/logger';
import { isKeycloakErrorBody } from '../../shared/utils/is-keycloak-error-body';
import { Session } from '../../types/session';

// Расширяем стандартный конфиг Axios для поддержки флага ретрая
export interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

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

  // Level 1: Карта логики
  private async handleResponseError(error: AxiosError) {
    try {
      await this.refreshTokens(error);             // обновляем токен или кидает ошибку
      return await this.client(error.config as RetryableConfig); // повторяем запрос
    } catch (err) {
      if (this.isInvalidGrant(err)) {
        await this.destroySession();               // уничтожаем сессию
        throw new UnauthorizedException('Session expired'); // бросаем 401
      }
      throw error;                                 // пробрасываем оригинальную ошибку
    }
  }

  // Level 2: Оглавление
  private async refreshTokens(error: AxiosError): Promise<void> {
    this.validateRetry(error);                       // проверяем можно ли повторить или кидает ошибку
    const session = this.getSession();               // берем сессию или кидает ошибку
    const config = this.markRetry(error.config);      // помечаем запрос как повторный
    await this.performRefresh(session, config);       // обновляем токен или кидает ошибку
  }

  // Level 3: Шаги с деталями
  private validateRetry(error: AxiosError): void {
    const config = error.config as RetryableConfig | undefined;
    if (error.response?.status !== 401 || !config || config._retry) {
      throw error;
    }
  }

  private getSession(): Session {
    const session = this.request.session;
    if (!session) throw new Error('No session found in request context');
    return session;
  }

  private markRetry(config: InternalAxiosRequestConfig | undefined): RetryableConfig {
    return { ...config as RetryableConfig, _retry: true };
  }

  private async performRefresh(session: Session, config: RetryableConfig): Promise<void> {
    const acquired = await this.refreshLock.acquire(session.id);
    if (!acquired) {
      await this.handleConcurrentRefresh(session, config); // ждем параллельное обновление
      return;
    }
    try {
      await this.executeRefresh(session, config);          // выполняем обновление
    } finally {
      await this.refreshLock.release(session.id);          // освобождаем лок в любом случае
    }
  }

  // Level 4: Атомарные действия
  private async handleConcurrentRefresh(session: Session, config: RetryableConfig): Promise<void> {
    await this.refreshLock.waitAndRetry(session.id);
    const updated = await this.sessionService.get(session.id);
    if (updated) {
      this.request.session = updated;
      this.applyToken(updated.tokens.accessToken, config);
    }
  }

  private async executeRefresh(session: Session, config: RetryableConfig): Promise<void> {
    Logger.warn('HttpClient', '401 — refreshing token', { url: config.url });
    const newTokens = await this.authService.refreshTokens(session.id, session.tokens);
    this.request.session = { ...session, tokens: newTokens };
    this.applyToken(newTokens.accessToken, config);
    Logger.info('HttpClient', 'Token refreshed, retrying', { url: config.url });
  }

  // Level 5: Примитивы
  private applyToken(accessToken: string, config: RetryableConfig): void {
    config.headers.Authorization = `Bearer ${accessToken}`;
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
}
