import { Session } from './session';

declare module 'express' {
  interface Request {
    session?: Session;
  }
}
