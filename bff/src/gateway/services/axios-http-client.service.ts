import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import axios, { AxiosError,AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { Request } from 'express';

import { AuthService } from '../../auth/services/auth.service';
import { SessionService } from '../../session/services/session.service';
import { TokenRefreshLock } from '../../session/services/token-refresh-lock.service';
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
      await this.refreshTokens(error); // обновляем токен или кидает ошибку
      return await this.client(error.config as RetryableConfig); // повторяем запрос
    } catch (err) {
      await this.handleRefreshError(err); // обрабатываем ошибку обновления или кидает 401
      throw error; // пробрасываем оригинальную ошибку
    }
  }

  // Level 2: Оглавление
  private async refreshTokens(error: AxiosError): Promise<void> {
    const config = this.validateRetry(error); // валидируем и получаем конфиг или кидает ошибку
    const session = this.getSession(); // берем сессию или кидает ошибку
    const retryConfig = this.markRetry(config); // помечаем запрос как повторный
    await this.performRefresh(session, retryConfig); // обновляем токен или кидает ошибку
  }

  // Level 3: Шаги с деталями
  private validateRetry(error: AxiosError): InternalAxiosRequestConfig {
    const config = error.config;
    if (error.response?.status !== 401 || !config || (config as RetryableConfig)._retry) {
      throw error;
    }
    return config;
  }

  private getSession(): Session {
    const session = this.request.session;
    if (!session) throw new Error('No session found in request context');
    return session;
  }

  // Помечаем запрос как повторный для предотвращения бесконечного цикла ретраев
  private markRetry(config: InternalAxiosRequestConfig): RetryableConfig {
    return { ...config, _retry: true };
  }

  private async performRefresh(session: Session, config: RetryableConfig): Promise<void> {
    const { acquired, owner } = await this.refreshLock.acquire(session.id); // пытаемся забрать lock
    if (!acquired) {
      await this.handleConcurrentRefresh(session); // ждем параллельное обновление
      return;
    }
    try {
      await this.executeRefresh(session, config); // выполняем обновление
    } finally {
      await this.refreshLock.release(session.id, owner); // освобождаем lock с указанием владельца
    }
  }

  // Level 4: Атомарные действия
  // Обрабатываем конкурентное обновление токена: ждем разблокировки и обновляем локальный контекст
  private async handleConcurrentRefresh(session: Session): Promise<void> {
    await this.refreshLock.waitAndRetry(session.id); // ждем разблокировки
    const updated = await this.sessionService.get(session.id); // берем обновленную сессию

    if (!updated) {
      throw new UnauthorizedException('Session expired during refresh'); // бросаем 401 если сессия исчезла
    }

    this.request.session = updated; // обновляем контекст запроса
  }

  // Выполняем обновление токенов через Auth сервис и обновляем контекст запроса
  private async executeRefresh(session: Session, config: RetryableConfig): Promise<void> {
    Logger.warn('HttpClient', '401 — refreshing token', { url: config.url });
    const newTokens = await this.authService.refreshTokens(session.id, session.tokens); // обновляем токены в Keycloak и Redis
    this.request.session = { ...session, tokens: newTokens }; // обновляем сессию в памяти
    Logger.info('HttpClient', 'Token refreshed, retrying', { url: config.url });
  }

  // Level 5: Примитивы
  private async destroySession(): Promise<void> {
    const session = this.request.session;
    if (session) {
      await this.sessionService.destroy(session.id, session.user.id); // удаляем сессию из Redis
    }
  }

  private async handleRefreshError(err: unknown) {
    if (this.isInvalidGrant(err)) {
      await this.destroySession(); // уничтожаем сессию
      throw new UnauthorizedException('Session expired'); // бросаем 401
    }
  }

  private isInvalidGrant(error: unknown): boolean {
    if (!(error instanceof AxiosError)) return false;
    if (error.response?.status !== 400) return false;
    const { data } = error.response;
    return isKeycloakErrorBody(data) && data.error === 'invalid_grant';
  }
}
