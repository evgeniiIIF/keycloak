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
import crypto from 'crypto';
import {
  IS_PUBLIC_KEY,
  REQUIRE_SESSION,
  REQUIRE_CSRF,
  ROLES_KEY,
  RolesMeta,
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
    const rolesMeta = this.reflector.getAllAndOverride<RolesMeta | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    let tokenPayload: KeycloakJwtPayload | undefined;

    // Session check
    if (requireSession) {
      if (!session?.accessToken) {
        throw new UnauthorizedException('No session');
      }

      try {
        tokenPayload = decodeJwt(session.accessToken) as KeycloakJwtPayload;
      } catch {
        throw new UnauthorizedException('Invalid token');
      }
    }

    // CSRF check
    if (requireCsrf) {
      const cookie = cookies?.['XSRF-TOKEN'];
      const header = headers['x-csrf-token'];
      const cookieStr = typeof cookie === 'string' ? cookie : undefined;
      const headerStr = typeof header === 'string' ? header : undefined;
      if (
        !cookieStr ||
        !headerStr ||
        cookieStr.length !== headerStr.length ||
        !crypto.timingSafeEqual(Buffer.from(cookieStr), Buffer.from(headerStr))
      ) {
        throw new ForbiddenException('Invalid CSRF token');
      }
    }

    // Roles check
    if (rolesMeta?.roles?.length) {
      if (!session?.accessToken) {
        throw new ForbiddenException('No session');
      }

      if (!tokenPayload) {
        try {
          tokenPayload = decodeJwt(session.accessToken) as KeycloakJwtPayload;
        } catch {
          throw new ForbiddenException('Invalid token');
        }
      }

      const source = rolesMeta.source || 'realm';
      const userRoles: string[] =
        source === 'realm'
          ? tokenPayload?.realm_access?.roles || []
          : tokenPayload?.resource_access?.[source]?.roles || [];

      const mode = rolesMeta.mode || 'any';
      const ok =
        mode === 'all'
          ? rolesMeta.roles.every((r) => userRoles.includes(r))
          : rolesMeta.roles.some((r) => userRoles.includes(r));

      if (!ok) {
        throw new ForbiddenException('Insufficient roles');
      }
    }

    return true;
  }
}
