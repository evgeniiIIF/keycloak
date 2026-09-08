import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { config } from '../../config/config';
import { SessionService } from '../../session/services/session.service';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
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
    
    req.session = session;
    return true;
  }
}
