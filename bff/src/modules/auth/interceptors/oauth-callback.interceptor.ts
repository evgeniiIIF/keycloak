import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { EMPTY, Observable } from 'rxjs';

import { AppConfigService } from '@/config/app-config.service';
import { Logger } from '@/shared/logger/logger';

import { OAuthCallbackDto } from '../dto/oauth-callback.dto';

@Injectable()
export class OAuthCallbackInterceptor implements NestInterceptor {
  constructor(private readonly config: AppConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const query = req.query as unknown as OAuthCallbackDto;
    const { error, code, state } = query;

    if (error) {
      Logger.warn('Auth', `OAuth error: ${error}`);
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
