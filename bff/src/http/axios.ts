import axios, { AxiosError, AxiosInstance } from 'axios';
import { UnauthorizedException } from '@nestjs/common';
import { sessionService } from '../services/session.service';
import { authService } from '../services/auth.service';
import { Logger } from '../utils/logger';

export const axiosInstance: AxiosInstance = axios.create();

axiosInstance.interceptors.request.use(async (config) => {
  const sessionId = config.headers?.['X-Session-ID'] as string;

  if (!sessionId) return config;

  const session = await sessionService.getSession(sessionId);

  if (!session) return config;

  config.headers.Authorization = `Bearer ${session.accessToken}`;
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const isInvalidAccessToken = status === 401;
    const isInvalidRefreshToken = status === 400 && (error.response?.data as any)?.error === 'invalid_grant';

    switch (true) {
      case isInvalidAccessToken:
        return handleInvalidAccessToken(error);
      case isInvalidRefreshToken:
        return handleInvalidRefreshToken(error);
      default:
        throw error;
    }
  },
);

function sessionIdShort(sessionId: string): string {
  return sessionId.slice(0, 8);
}

async function handleInvalidAccessToken(error: AxiosError) {
  const originalRequest = error.config;
  const isRetry = (originalRequest as any)._retry;
  const sessionId = originalRequest?.headers?.['X-Session-ID'] as string;

  if (isRetry || !sessionId) return;

  (originalRequest as any)._retry = true;
  delete originalRequest.headers['X-Session-ID'];

  Logger.warn('HttpClient', `401 from protected-service, refreshing token...`, {
    url: originalRequest.url || '?',
    session: sessionIdShort(sessionId),
    status: '401',
  });

  try {
    const newToken = await authService.refreshAccessToken(sessionId);
    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    Logger.info('HttpClient', 'Token refreshed, retrying request', {
      url: originalRequest.url || '?',
      session: sessionIdShort(sessionId),
    });
    return axiosInstance(originalRequest);
  } catch (refreshError: any) {
    const refreshStatus = refreshError.response?.status;
    const refreshErrorType = refreshError.response?.data?.error;
    const refreshErrorReason = refreshError.response?.data?.error_description;

    if (refreshStatus === 400 && refreshErrorType === 'invalid_grant') {
      Logger.error('HttpClient', `Refresh token rejected: ${refreshStatus} ${refreshErrorType}`, {
        session: sessionIdShort(sessionId),
        reason: refreshErrorReason || 'Token is not active',
        url: originalRequest.url || '?',
      });
      await sessionService.deleteSession(sessionId);
      throw new UnauthorizedException('Session expired');
    }

    Logger.error('HttpClient', `Token refresh failed: ${refreshStatus || 'unknown'} ${refreshErrorType || refreshError.message}`, {
      session: sessionIdShort(sessionId),
      url: originalRequest.url || '?',
    });
    throw refreshError;
  }
}

function handleInvalidRefreshToken(error: AxiosError) {
  const sessionId = error.config?.headers?.['X-Session-ID'] as string;
  const kcError = (error.response?.data as any)?.error;
  const kcReason = (error.response?.data as any)?.error_description;

  if (sessionId) {
    Logger.error('HttpClient', `Refresh token rejected directly: ${error.response?.status} ${kcError || 'unknown'}`, {
      session: sessionIdShort(sessionId),
      reason: kcReason || '-',
    });
    sessionService.deleteSession(sessionId);
  }

  throw new UnauthorizedException('Session expired');
}
