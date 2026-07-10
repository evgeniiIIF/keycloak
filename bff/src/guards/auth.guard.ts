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
