import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { config } from '@/config/config';
import { SessionService } from '@/modules/auth/sessions/services/session.service';
import { Session } from '@/modules/auth/types/session';

import { IS_PUBLIC_KEY } from '../decorators/auth.decorator';
import { AuthService } from '../services/auth.service';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const sessionId = req.cookies?.[config.session.cookieName];
    if (!sessionId) throw new UnauthorizedException('Not authenticated');

    const session = await this.sessionService.get(sessionId);
    if (!session) throw new UnauthorizedException('Not authenticated');

    await this.sessionService.touch(sessionId, session.user.id);
    
    if (!SAFE_METHODS.includes(req.method)) {
      this.validateCsrf(req, session);
    }

    req.session = session;
    return true;
  }

  private validateCsrf(req: Request, session: Session): void {
    const csrfToken = req.headers['x-csrf-token'] as string | undefined;
    if (!this.authService.validateCsrfToken(session, csrfToken)) {
      throw new UnauthorizedException('Invalid CSRF token');
    }
  }
}
