import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SecurityMiddleware } from './security.middleware';
import { BffSession } from '../types/session';

function makeToken(expSecondsFromNow = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `header.${payload}.sig`;
}

describe('SecurityMiddleware', () => {
  const middleware = new SecurityMiddleware();

  function createReq(path: string, method: string, opts?: {
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    session?: Partial<BffSession>;
  }) {
    return {
      path,
      method,
      cookies: opts?.cookies || {},
      headers: opts?.headers || {},
      session: opts?.session,
    } as Parameters<typeof middleware.use>[0];
  }

  function run(middleware: SecurityMiddleware, req: Parameters<typeof middleware.use>[0]): { error?: Error; nexted: boolean } {
    let error: Error | undefined;
    let nexted = false;
    middleware.use(req, {} as Parameters<typeof middleware.use>[1], ((err?: Error) => {
      if (err) error = err;
      else nexted = true;
    }) as Parameters<typeof middleware.use>[2]);
    return { error, nexted };
  }

  describe('public routes', () => {
    it('allows /login', () => {
      const { nexted } = run(middleware, createReq('/login', 'GET'));
      expect(nexted).toBe(true);
    });

    it('allows /health', () => {
      const { nexted } = run(middleware, createReq('/health', 'GET'));
      expect(nexted).toBe(true);
    });

    it('allows /health/readiness', () => {
      const { nexted } = run(middleware, createReq('/health/readiness', 'GET'));
      expect(nexted).toBe(true);
    });
  });

  describe('deny by default', () => {
    it('rejects unknown routes', () => {
      const { error } = run(middleware, createReq('/unknown', 'GET'));
      expect(error).toBeInstanceOf(ForbiddenException);
    });
  });

  describe('session check', () => {
    it('rejects when no session', () => {
      const { error } = run(middleware, createReq('/api/me', 'GET'));
      expect(error).toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when no accessToken', () => {
      const { error } = run(middleware, createReq('/api/me', 'GET', { session: {} }));
      expect(error).toBeInstanceOf(UnauthorizedException);
    });

    it('allows when valid token', () => {
      const { nexted } = run(middleware, createReq('/api/me', 'GET', {
        session: { accessToken: makeToken() },
      }));
      expect(nexted).toBe(true);
    });
  });

  describe('CSRF check', () => {
    it('rejects when CSRF header missing', () => {
      const { error } = run(middleware, createReq('/logout', 'POST', {
        session: { accessToken: makeToken() },
        cookies: { 'XSRF-TOKEN': 'abc' },
      }));
      expect(error).toBeInstanceOf(ForbiddenException);
    });

    it('rejects when CSRF cookie and header mismatch', () => {
      const { error } = run(middleware, createReq('/logout', 'POST', {
        session: { accessToken: makeToken() },
        headers: { 'x-csrf-token': 'wrong' },
        cookies: { 'XSRF-TOKEN': 'abc' },
      }));
      expect(error).toBeInstanceOf(ForbiddenException);
    });
  });

  describe('HTTP method matching', () => {
    it('matches POST/PUT/DELETE/PATCH for /api/service/**', () => {
      for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
        const { nexted } = run(middleware, createReq('/api/service/foo', method, {
          session: { accessToken: makeToken() },
          headers: { 'x-csrf-token': 'abc' },
          cookies: { 'XSRF-TOKEN': 'abc' },
        }));
        expect(nexted).toBe(true);
      }
    });
  });
});
