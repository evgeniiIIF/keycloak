import { UnauthorizedException } from '@nestjs/common';
import type { Session, SessionData } from 'express-session';
import type { AuthSession } from '../../types/session';

export function assertAuthenticated(session: Session & Partial<SessionData>): AuthSession {
  if (
    !session.accessToken ||
    !session.refreshToken ||
    !session.idToken ||
    !session.userInfo?.sub
  ) {
    throw new UnauthorizedException('Session not authenticated');
  }
  console.log('Assert OK');
  
  return session as AuthSession;
}
