import { Session } from '@/modules/auth/types/session';

declare module 'express' {
  interface Request {
    session?: Session;
  }
}
