import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { SessionService } from '@services/session.service';
import { Logger } from '../utils/logger';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionId = request.cookies?.SESSION_ID;

    if (!sessionId) {
      Logger.warn('SessionGuard', `No SESSION_ID cookie`);
      throw new BadRequestException('No session');
    }

    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      Logger.warn('SessionGuard', `Session ${sessionId.slice(0, 8)} not found in Redis`);
      throw new BadRequestException('Invalid session');
    }

    request.userSession = session;
    return true;
  }
}
