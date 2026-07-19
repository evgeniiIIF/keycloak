import 'express-session';
import type { Session } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    userInfo?: {
      sub: string;
      email?: string;
      preferred_username?: string;
      name?: string;
    };
  }
}

export type AuthSession = Session & {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  userInfo: {
    sub: string;
    email?: string;
    preferred_username?: string;
    name?: string;
  };
};
