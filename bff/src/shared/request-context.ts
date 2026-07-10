import { AsyncLocalStorage } from 'async_hooks';
import { BffSession } from '../types/session';

export interface RequestCtx {
  session: BffSession;
}

export const requestContext = new AsyncLocalStorage<RequestCtx>();
