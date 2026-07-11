import { Session, SessionData } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    oauth?: { state: string; codeVerifier: string };
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

export type BffSession = Session & Partial<SessionData>;
