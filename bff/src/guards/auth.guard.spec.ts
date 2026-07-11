import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import {
  IS_PUBLIC_KEY,
  REQUIRE_SESSION,
  REQUIRE_CSRF,
  ROLES_KEY,
  RolesMeta,
} from '../decorators/auth.decorator';

function makeJwt(payload: Record<string, unknown>, exp?: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  return `${header}.${body}.`;
}

function createGuard(metadata: Record<string, unknown>) {
  const reflector = {
    getAllAndOverride: jest.fn().mockImplementation((key: string) => metadata[key]),
  } as unknown as Reflector;
  return new AuthGuard(reflector);
}

function createContext(opts: {
  session?: Record<string, unknown>;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        session: opts.session,
        cookies: opts.cookies,
        headers: opts.headers,
      }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  describe('public endpoint', () => {
    it('bypasses all checks when isPublic is true', () => {
      const guard = createGuard({ [IS_PUBLIC_KEY]: true });
      const ctx = createContext({});
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('session check', () => {
    it('throws UnauthorizedException when session is missing', () => {
      const guard = createGuard({ [REQUIRE_SESSION]: true });
      const ctx = createContext({});
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when accessToken is missing', () => {
      const guard = createGuard({ [REQUIRE_SESSION]: true });
      const ctx = createContext({ session: {} });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token is malformed', () => {
      const guard = createGuard({ [REQUIRE_SESSION]: true });
      const ctx = createContext({ session: { accessToken: 'not-a-jwt' } });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('passes when token is valid', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const token = makeJwt({ sub: 'user-1' }, futureExp);
      const guard = createGuard({ [REQUIRE_SESSION]: true });
      const ctx = createContext({ session: { accessToken: token } });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('CSRF check', () => {
    it('throws ForbiddenException when cookie is missing', () => {
      const guard = createGuard({ [REQUIRE_CSRF]: true });
      const ctx = createContext({ headers: { 'x-csrf-token': 'abc' } });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when header is missing', () => {
      const guard = createGuard({ [REQUIRE_CSRF]: true });
      const ctx = createContext({ cookies: { 'XSRF-TOKEN': 'abc' }, headers: {} });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when values mismatch', () => {
      const guard = createGuard({ [REQUIRE_CSRF]: true });
      const ctx = createContext({
        cookies: { 'XSRF-TOKEN': 'abc' },
        headers: { 'x-csrf-token': 'xyz' },
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('passes when cookie and header match', () => {
      const guard = createGuard({ [REQUIRE_CSRF]: true });
      const ctx = createContext({
        cookies: { 'XSRF-TOKEN': 'abc' },
        headers: { 'x-csrf-token': 'abc' },
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('roles check', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;

    function tokenWithRoles(realmRoles: string[], resourceRoles?: Record<string, { roles: string[] }>) {
      return makeJwt(
        {
          sub: 'user-1',
          realm_access: { roles: realmRoles },
          resource_access: resourceRoles,
        },
        futureExp,
      );
    }

    it('throws ForbiddenException when user lacks required role (mode: any)', () => {
      const token = tokenWithRoles(['viewer']);
      const guard = createGuard({
        [REQUIRE_SESSION]: true,
        [ROLES_KEY]: { roles: ['admin'] } satisfies RolesMeta,
      });
      const ctx = createContext({ session: { accessToken: token } });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('passes when user has at least one required role (mode: any)', () => {
      const token = tokenWithRoles(['viewer', 'editor']);
      const guard = createGuard({
        [REQUIRE_SESSION]: true,
        [ROLES_KEY]: { roles: ['admin', 'editor'] } satisfies RolesMeta,
      });
      const ctx = createContext({ session: { accessToken: token } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('throws ForbiddenException when user lacks all roles (mode: all)', () => {
      const token = tokenWithRoles(['viewer']);
      const guard = createGuard({
        [REQUIRE_SESSION]: true,
        [ROLES_KEY]: { roles: ['admin', 'editor'], mode: 'all' } satisfies RolesMeta,
      });
      const ctx = createContext({ session: { accessToken: token } });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('passes when user has all required roles (mode: all)', () => {
      const token = tokenWithRoles(['admin', 'editor']);
      const guard = createGuard({
        [REQUIRE_SESSION]: true,
        [ROLES_KEY]: { roles: ['admin', 'editor'], mode: 'all' } satisfies RolesMeta,
      });
      const ctx = createContext({ session: { accessToken: token } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('checks resource_access when source is specified', () => {
      const token = tokenWithRoles([], { account: { roles: ['admin'] } });
      const guard = createGuard({
        [REQUIRE_SESSION]: true,
        [ROLES_KEY]: { roles: ['admin'], source: 'account' } satisfies RolesMeta,
      });
      const ctx = createContext({ session: { accessToken: token } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('throws ForbiddenException when resource role is missing', () => {
      const token = tokenWithRoles([], { account: { roles: ['viewer'] } });
      const guard = createGuard({
        [REQUIRE_SESSION]: true,
        [ROLES_KEY]: { roles: ['admin'], source: 'account' } satisfies RolesMeta,
      });
      const ctx = createContext({ session: { accessToken: token } });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when session is missing for roles check', () => {
      const guard = createGuard({
        [ROLES_KEY]: { roles: ['admin'] } satisfies RolesMeta,
      });
      const ctx = createContext({});
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('combined checks', () => {
    it('enforces session + CSRF together', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const token = makeJwt({ sub: 'user-1' }, futureExp);
      const guard = createGuard({ [REQUIRE_SESSION]: true, [REQUIRE_CSRF]: true });

      // Missing CSRF
      const ctxNoCsrf = createContext({ session: { accessToken: token }, headers: {} });
      expect(() => guard.canActivate(ctxNoCsrf)).toThrow(ForbiddenException);

      // Valid CSRF
      const ctxOk = createContext({
        session: { accessToken: token },
        cookies: { 'XSRF-TOKEN': 'abc' },
        headers: { 'x-csrf-token': 'abc' },
      });
      expect(guard.canActivate(ctxOk)).toBe(true);
    });
  });
});
