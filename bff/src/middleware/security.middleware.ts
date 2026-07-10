import { Injectable, NestMiddleware, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { decodeJwt } from 'jose';
import { RouteRule, ROUTE_RULES } from '../config/routes';
import { Logger } from '../shared/logger';
import { KeycloakJwtPayload } from '../types/keycloak';

function matchPath(pattern: string, path: string): boolean {
  if (pattern === path) return true;
  const pp = pattern.split('/').filter(Boolean);
  const tp = path.split('/').filter(Boolean);
  let pi = 0;
  let ti = 0;
  while (pi < pp.length && ti < tp.length) {
    if (pp[pi] === '**') return true;
    if (pp[pi] === tp[ti]) { pi++; ti++; continue; }
    return false;
  }
  return pi === pp.length && ti === tp.length;
}

function matchRule(path: string, method: string): RouteRule | undefined {
  return ROUTE_RULES.find((rule) => {
    if (!matchPath(rule.pattern, path)) return false;
    if (rule.method) {
      const methods = Array.isArray(rule.method) ? rule.method : [rule.method];
      if (!methods.includes(method)) return false;
    }
    return true;
  });
}

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const rule = matchRule(req.path, req.method);

    if (!rule) {
      Logger.warn('Security', 'No rule — denied', { path: req.path, method: req.method });
      next(new ForbiddenException('Route not configured'));
      return;
    }

    if (rule.public) { next(); return; }

    const { session } = req;

    // Session check
    if (rule.session) {
      if (!session?.accessToken) {
        next(new UnauthorizedException('No session'));
        return;
      }

      if (!rule.skipExpiryCheck) {
        try {
          const payload = decodeJwt(session.accessToken);
          if (payload?.exp) {
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp < now + 30) {
              next(new UnauthorizedException('Token expired — refresh first'));
              return;
            }
          }
        } catch {
          next(new UnauthorizedException('Invalid token'));
          return;
        }
      }
    }

    // CSRF check
    if (rule.csrf) {
      const cookie = req.cookies?.['XSRF-TOKEN'];
      const header = req.headers['x-csrf-token'];
      if (!cookie || !header || cookie !== header) {
        next(new ForbiddenException('Invalid CSRF token'));
        return;
      }
      if (session?.csrfToken && session.csrfToken !== cookie) {
        next(new ForbiddenException('CSRF token mismatch'));
        return;
      }
    }

    // Roles check
    if (rule.roles?.length) {
      if (!session?.accessToken) {
        next(new ForbiddenException('No session'));
        return;
      }

      const payload = decodeJwt(session.accessToken) as KeycloakJwtPayload;
      const source = rule.roleSource || 'realm';
      const userRoles: string[] =
        source === 'realm'
          ? payload?.realm_access?.roles || []
          : payload?.resource_access?.[source]?.roles || [];

      const mode = rule.roleMatch || 'any';
      const ok = mode === 'all'
        ? rule.roles.every((r) => userRoles.includes(r))
        : rule.roles.some((r) => userRoles.includes(r));

      if (!ok) {
        Logger.warn('Security', 'Insufficient roles', {
          required: rule.roles.join(','),
          actual: userRoles.join(','),
        });
        next(new ForbiddenException('Insufficient roles'));
        return;
      }
    }

    next();
  }
}
