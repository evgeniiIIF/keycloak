import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosError } from 'axios';
import { Request, Response } from 'express';

import { AppLogger } from '../logger/app-logger.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext('HttpExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (resp && typeof resp === 'object' && 'message' in resp) {
        message = (resp as { message?: string | string[] }).message || 'Error';
      }
    } else if (exception instanceof AxiosError && exception.response) {
      status = exception.response.status;
      const data = exception.response.data as Record<string, unknown> | undefined;

      // Возвращаем детали только если это стандартная ошибка OAuth2, иначе — общую фразу
      const isOAuthError = data?.error === 'invalid_grant' || data?.error === 'access_denied';
      message = isOAuthError
        ? String(data?.error_description || data?.error || 'OAuth error')
        : 'Backend service error';
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    this.logger.error(`${req.method} ${req.url} → ${status}`, {
      error: exception instanceof Error ? exception.message : String(exception),
    });

    if (res.headersSent) {
      return;
    }

    res.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
