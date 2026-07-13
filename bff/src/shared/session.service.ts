import { Injectable } from '@nestjs/common';
import { requestContext } from './request-context';
import { BffSession } from '../types/session';

@Injectable()
export class SessionService {
  get(): BffSession | undefined {
    return requestContext.getStore()?.req?.session;
  }

  reload(session: BffSession): Promise<void> {
    return new Promise((resolve, reject) => {
      session.reload((err: any) => (err ? reject(err) : resolve()));
    });
  }

  save(session: BffSession): Promise<void> {
    return new Promise((resolve, reject) => {
      session.save((err: any) => (err ? reject(err) : resolve()));
    });
  }

  destroy(session: BffSession): Promise<void> {
    return new Promise((resolve, reject) => {
      session.destroy((e: any) => (e ? reject(e) : resolve()));
    });
  }
}
