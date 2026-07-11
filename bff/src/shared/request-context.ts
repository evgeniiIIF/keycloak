import { AsyncLocalStorage } from 'async_hooks';
import { Request } from 'express';

export interface RequestCtx {
  req: Request;
}

export const requestContext = new AsyncLocalStorage<RequestCtx>();
