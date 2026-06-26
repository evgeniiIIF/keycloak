import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionService } from '@services/session.service';
import { Logger } from '../utils/logger';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionId = request.cookies?.SESSION_ID;

    if (!sessionId) {
      Logger.warn('SessionGuard', `No SESSION_ID cookie`, {
        method: request.method,
        path: request.path,
      });
      throw new UnauthorizedException('No session');
    }

    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      Logger.warn('SessionGuard', `Session not found in Redis — expired or deleted`, {
        session: sessionId.slice(0, 8),
        method: request.method,
        path: request.path,
      });
      throw new UnauthorizedException('Invalid session');
    }

    request.userSession = session;
    return true;
  }
}
