import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, EMPTY } from 'rxjs';
import { Request, Response } from 'express';
import { config } from '../../config/config';
import { Logger } from '../../shared/logger/logger';
import { OAuthCallbackDto } from '../dto/oauth-callback.dto';

@Injectable()
export class OAuthCallbackInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const query = req.query as unknown as OAuthCallbackDto;
    const { error, code, state } = query;

    if (error) {
      Logger.warn('Auth', `OAuth error: ${error}`);
      res.redirect(`${config.frontendUrl}/login?error=${error}`);
      return EMPTY;
    }

    if (!code || !state) {
      res.redirect(`${config.frontendUrl}/login?error=missing_params`);
      return EMPTY;
    }

    return next.handle();
  }
}
