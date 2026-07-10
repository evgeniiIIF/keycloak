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
