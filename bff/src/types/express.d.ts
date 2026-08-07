import { Session } from './session';

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}
