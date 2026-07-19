import { Injectable } from '@nestjs/common';
import { requestContext } from '../../shared/request-context';
import type { AuthSession } from '../../types/session';

@Injectable()
export class SessionService {
  get(): AuthSession | undefined {
    return requestContext.getStore()?.req?.session as AuthSession | undefined;
  }

  reload(session: AuthSession): Promise<void> {
    return new Promise((resolve, reject) => {
      session.reload((err: Error) => (err ? reject(err) : resolve()));
    });
  }

  save(session: AuthSession): Promise<void> {
    return new Promise((resolve, reject) => {
      session.save((err: Error) => (err ? reject(err) : resolve()));
    });
  }

  destroy(session: AuthSession): Promise<void> {
    return new Promise((resolve, reject) => {
      session.destroy((e: Error) => (e ? reject(e) : resolve()));
    });
  }

  setTokens(session: AuthSession, accessToken: string, refreshToken: string, idToken?: string): void {
    session.accessToken = accessToken;
    session.refreshToken = refreshToken;
    if (idToken) {
      session.idToken = idToken;
    }
  }

  setUserInfo(session: AuthSession, userInfo: { sub: string; email?: string; preferred_username?: string; name?: string }): void {
    session.userInfo = userInfo;
  }
}
