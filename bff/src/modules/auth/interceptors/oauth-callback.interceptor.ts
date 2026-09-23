import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { EMPTY, Observable } from 'rxjs';

import { AppConfigService } from '@/config/app-config.service';
import { AppLogger } from '@/shared/logger/app-logger.service';

import { OAuthCallbackDto } from '../dto/oauth-callback.dto';

@Injectable()
export class OAuthCallbackInterceptor implements NestInterceptor {
  constructor(
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('OAuthCallbackInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const query = req.query as unknown as OAuthCallbackDto;
    const { error, code, state } = query;

    if (error) {
      this.logger.warn(`OAuth error: ${error}`);
      res.redirect(`${this.config.frontendUrl}/login?error=${error}`);
      return EMPTY;
    }

    if (!code || !state) {
      res.redirect(`${this.config.frontendUrl}/login?error=missing_params`);
      return EMPTY;
    }

    return next.handle();
  }
}
