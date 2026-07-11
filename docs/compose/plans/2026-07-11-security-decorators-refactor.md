# Security Decorators & Guard Refactoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace route-based security middleware with NestJS decorator-driven guards, simplifying security configuration and making it co-located with controllers.

**Architecture:** Move from a centralized `SecurityMiddleware` that matches routes against a rules table (`routes.ts`) to NestJS-native `@Public()`, `@RequireSession()`, `@RequireCsrf()`, `@Roles()` decorators applied directly on controller methods. A global `AuthGuard` reads these metadata keys via `Reflector` and enforces them.

**Tech Stack:** NestJS, Reflector, `jose` (decodeJwt), Express types

## Global Constraints

- CSRF check compares cookie `XSRF-TOKEN` with header `x-csrf-token` (double-submit pattern)
- Token expiry check: reject if `exp < now + 30` (30s skew)
- `@RequireCsrf()` also validates session-level `csrfToken` matches cookie
- Roles decorator supports `mode: 'any' | 'all'` and `source` (default `'realm'`)
- `APP_GUARD` providers: ThrottlerGuard first, then AuthGuard (both apply globally)
- No changes to `CsrfMiddleware` cookie logic except removing session save

---

## Task 1: Create auth decorators

**Covers:** Decorator definitions for Public, RequireSession, RequireCsrf, SkipExpiryCheck, Roles

**Files:**
- Create: `bff/src/decorators/auth.decorator.ts`

- [ ] **Step 1: Create decorator file**

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const REQUIRE_SESSION = 'requireSession';
export const RequireSession = () => SetMetadata(REQUIRE_SESSION, true);

export const REQUIRE_CSRF = 'requireCsrf';
export const RequireCsrf = () => SetMetadata(REQUIRE_CSRF, true);

export const SKIP_EXPIRY_CHECK = 'skipExpiryCheck';
export const SkipExpiryCheck = () => SetMetadata(SKIP_EXPIRY_CHECK, true);

export const ROLES_KEY = 'roles';
export const Roles = (
  roles: string[],
  options?: { mode?: 'any' | 'all'; source?: string },
) => SetMetadata(ROLES_KEY, { roles, ...options });
```

- [ ] **Step 2: Commit**

```bash
git add bff/src/decorators/auth.decorator.ts
git commit -m "feat(bff): add auth decorators for guard-based security"
```

---

## Task 2: Create AuthGuard

**Covers:** Global guard that reads decorator metadata and enforces session, CSRF, expiry, and role checks

**Files:**
- Create: `bff/src/guards/auth.guard.ts`

- [ ] **Step 1: Create guard file**

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { decodeJwt } from 'jose';
import { Request } from 'express';
import {
  IS_PUBLIC_KEY,
  REQUIRE_SESSION,
  REQUIRE_CSRF,
  SKIP_EXPIRY_CHECK,
  ROLES_KEY,
} from '../decorators/auth.decorator';
import { KeycloakJwtPayload } from '../types/keycloak';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const { session, cookies, headers } = request;

    const requireSession = this.reflector.getAllAndOverride<boolean>(REQUIRE_SESSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requireCsrf = this.reflector.getAllAndOverride<boolean>(REQUIRE_CSRF, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipExpiryCheck = this.reflector.getAllAndOverride<boolean>(SKIP_EXPIRY_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    const rolesMeta = this.reflector.getAllAndOverride<any>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Session check
    if (requireSession) {
      if (!session?.accessToken) {
        throw new UnauthorizedException('No session');
      }

      if (!skipExpiryCheck) {
        try {
          const payload = decodeJwt(session.accessToken);
          const now = Math.floor(Date.now() / 1000);
          if (payload?.exp && payload.exp < now + 30) {
            throw new UnauthorizedException('Token expired');
          }
        } catch {
          throw new UnauthorizedException('Invalid token');
        }
      }
    }

    // CSRF check
    if (requireCsrf) {
      const cookie = cookies?.['XSRF-TOKEN'];
      const header = headers['x-csrf-token'];
      if (!cookie || !header || cookie !== header) {
        throw new ForbiddenException('Invalid CSRF token');
      }
    }

    // Roles check
    if (rolesMeta?.roles?.length) {
      if (!session?.accessToken) {
        throw new ForbiddenException('No session');
      }
      const payload = decodeJwt(session.accessToken) as KeycloakJwtPayload;
      const source = rolesMeta.source || 'realm';
      const userRoles: string[] =
        source === 'realm'
          ? payload?.realm_access?.roles || []
          : payload?.resource_access?.[source]?.roles || [];

      const mode = rolesMeta.mode || 'any';
      const ok =
        mode === 'all'
          ? rolesMeta.roles.every((r: string) => userRoles.includes(r))
          : rolesMeta.roles.some((r: string) => userRoles.includes(r));

      if (!ok) {
        throw new ForbiddenException('Insufficient roles');
      }
    }

    return true;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add bff/src/guards/auth.guard.ts
git commit -m "feat(bff): add global AuthGuard with decorator-based security"
```

---

## Task 3: Update app.module.ts — register AuthGuard globally

**Covers:** Register AuthGuard as APP_GUARD, remove old middleware references

**Files:**
- Modify: `bff/src/app.module.ts`

- [ ] **Step 1: Update app.module.ts**

Replace the full file content:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AuthGuard } from './guards/auth.guard';
import { RedisService } from './services/redis.service';
import { JwksService } from './services/jwks.service';
import { KeycloakClient } from './services/keycloak-client';
import { AuthService } from './services/auth.service';
import { HttpClient } from './services/http-client';

import { AuthController } from './controllers/auth.controller';
import { ProxyController } from './controllers/proxy.controller';
import { HealthController } from './controllers/health.controller';
import { BackchannelController } from './controllers/backchannel.controller';

import { SessionContextInterceptor } from './interceptors/session-context.interceptor';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    TerminusModule,
  ],
  controllers: [AuthController, ProxyController, HealthController, BackchannelController],
  providers: [
    RedisService,
    JwksService,
    KeycloakClient,
    AuthService,
    HttpClient,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: SessionContextInterceptor },
  ],
  exports: [RedisService],
})
export class AppModule {}
```

- [ ] **Step 2: Commit**

```bash
git add bff/src/app.module.ts
git commit -m "feat(bff): register AuthGuard as global APP_GUARD"
```

---

## Task 4: Update main.ts — remove SecurityMiddleware

**Covers:** Remove SecurityMiddleware import and registration from bootstrap

**Files:**
- Modify: `bff/src/main.ts`

- [ ] **Step 1: Remove SecurityMiddleware lines**

Remove these two lines:
- Line 7: `import { SecurityMiddleware } from './middleware/security.middleware';`
- Lines 70-71: `const sec = app.get(SecurityMiddleware); app.use(sec.use.bind(sec));`

- [ ] **Step 2: Verify remaining content**

The file should retain: NestFactory, ValidationPipe, express, AppModule, config, RedisService, CsrfMiddleware, HttpExceptionFilter, Logger, cookieParser, helmet, session, RedisStore, and the full bootstrap function (minus SecurityMiddleware lines).

- [ ] **Step 3: Commit**

```bash
git add bff/src/main.ts
git commit -m "feat(bff): remove SecurityMiddleware from bootstrap"
```

---

## Task 5: Add decorators to AuthController

**Covers:** @Public on login/callback, @RequireSession on /api/me, @RequireSession + @RequireCsrf on logout (returning JSON)

**Files:**
- Modify: `bff/src/controllers/auth.controller.ts`

- [ ] **Step 1: Add imports**

Add to imports:
```typescript
import { Public, RequireSession, RequireCsrf } from '../decorators/auth.decorator';
```

- [ ] **Step 2: Add @Public() to login and callback**

```typescript
@Public()
@Get('login')
async login(@Req() req: Request, @Res() res: Response) {
```

```typescript
@Public()
@Get('callback')
async callback(@Query() query: CallbackQueryDto, @Req() req: Request, @Res() res: Response) {
```

- [ ] **Step 3: Add @RequireSession() to /api/me**

```typescript
@RequireSession()
@Get('api/me')
me(@Req() req: Request) {
```

- [ ] **Step 4: Update logout — add decorators, change to JSON response**

```typescript
@RequireSession()
@RequireCsrf()
@Post('logout')
async logout(@Req() req: Request, @Res() res: Response) {
  const { session } = req;
  const { idToken, refreshToken, userInfo } = session;
  const userId = userInfo?.sub;

  if (refreshToken) {
    await this.keycloak.revokeRefreshToken(refreshToken);
  }

  if (userId && session.id) {
    await this.authService.unregisterSession(userId, session.id).catch((err: unknown) => {
      Logger.warn('Auth', `Unregister session failed: ${errorMessage(err)}`);
    });
  }

  session.destroy((err: Error | null) => {
    if (err) Logger.error('Auth', `Session destroy: ${err.message}`);
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.clearCookie('XSRF-TOKEN', { path: '/' });
    const logoutUrl = idToken ? this.authService.getLogoutUrl(idToken) : '/login';
    res.json({ logoutUrl });
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add bff/src/controllers/auth.controller.ts
git commit -m "feat(bff): add auth decorators to AuthController, logout returns JSON"
```

---

## Task 6: Add decorators to ProxyController

**Covers:** @RequireSession on class, @RequireCsrf on mutation methods

**Files:**
- Modify: `bff/src/controllers/proxy.controller.ts`

- [ ] **Step 1: Add imports**

Add to imports:
```typescript
import { RequireSession, RequireCsrf } from '../decorators/auth.decorator';
```

- [ ] **Step 2: Add @RequireSession() at class level**

```typescript
@Controller('api/service')
@RequireSession()
export class ProxyController {
```

- [ ] **Step 3: Add @RequireCsrf() to POST, PUT, DELETE, PATCH**

```typescript
@Post('*')
@RequireCsrf()
async post(@Param('0') path: string, @Req() req: Request, @Res() res: Response) {
```

```typescript
@Put('*')
@RequireCsrf()
async put(@Param('0') path: string, @Req() req: Request, @Res() res: Response) {
```

```typescript
@Delete('*')
@RequireCsrf()
async delete(@Param('0') path: string, @Req() req: Request, @Res() res: Response) {
```

```typescript
@Patch('*')
@RequireCsrf()
async patch(@Param('0') path: string, @Req() req: Request, @Res() res: Response) {
```

- [ ] **Step 4: Commit**

```bash
git add bff/src/controllers/proxy.controller.ts
git commit -m "feat(bff): add auth decorators to ProxyController"
```

---

## Task 7: Add @Public() to BackchannelController and HealthController

**Covers:** Both controllers are fully public

**Files:**
- Modify: `bff/src/controllers/backchannel.controller.ts`
- Modify: `bff/src/controllers/health.controller.ts`

- [ ] **Step 1: Update BackchannelController**

Add import and decorator:
```typescript
import { Controller, Post, Req, Res, Header } from '@nestjs/common';
import { Public } from '../decorators/auth.decorator';
```

```typescript
@Public()
@Controller()
export class BackchannelController {
```

- [ ] **Step 2: Update HealthController**

Add import and decorator:
```typescript
import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../decorators/auth.decorator';
```

```typescript
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
```

- [ ] **Step 3: Commit**

```bash
git add bff/src/controllers/backchannel.controller.ts bff/src/controllers/health.controller.ts
git commit -m "feat(bff): mark BackchannelController and HealthController as public"
```

---

## Task 8: Simplify CsrfMiddleware — remove session save

**Covers:** Remove session.csrfToken write and session.save() from CSRF middleware

**Files:**
- Modify: `bff/src/middleware/csrf.middleware.ts`

- [ ] **Step 1: Simplify the middleware**

Replace the full file content:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { config } from '../config/config';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (!req.cookies['XSRF-TOKEN']) {
      const token = crypto.randomBytes(32).toString('hex');
      const isProd = config.nodeEnv === 'production';

      res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        secure: isProd,
        sameSite: 'strict',
        path: '/',
      });
    }
    next();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add bff/src/middleware/csrf.middleware.ts
git commit -m "feat(bff): simplify CsrfMiddleware — cookie-only, no session save"
```

---

## Task 9: Delete old files

**Covers:** Remove routes.ts, security.middleware.ts, security.middleware.spec.ts

**Files:**
- Delete: `bff/src/config/routes.ts`
- Delete: `bff/src/middleware/security.middleware.ts`
- Delete: `bff/src/middleware/security.middleware.spec.ts`

- [ ] **Step 1: Delete files**

```bash
git rm bff/src/config/routes.ts bff/src/middleware/security.middleware.ts bff/src/middleware/security.middleware.spec.ts
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(bff): remove old route-based security middleware"
```

---

## Task 10: Update client AuthContext — logout via POST

**Covers:** Client logout sends POST to /logout and follows the returned logoutUrl

**Files:**
- Modify: `client/src/context/AuthContext.tsx`

- [ ] **Step 1: Update logout function**

Replace the logout function:

```typescript
const logout = async () => {
  try {
    const response = await api.post('/logout');
    window.location.href = response.data.logoutUrl;
  } catch (error) {
    window.location.href = '/login';
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/context/AuthContext.tsx
git commit -m "feat(client): logout via POST, follow returned logoutUrl"
```

---

## Task 11: Verify — build and type-check

**Covers:** Ensure everything compiles

**Files:** None (verification only)

- [ ] **Step 1: Type-check BFF**

```bash
cd bff && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 2: Type-check client**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run BFF tests (if any exist beyond deleted spec)**

```bash
cd bff && npx jest --passWithNoTests
```

Expected: PASS or no tests found
