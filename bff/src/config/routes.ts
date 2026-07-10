export interface RouteRule {
  pattern: string;
  method?: string | string[];
  session?: boolean;
  csrf?: boolean;
  roles?: string[];
  roleMatch?: 'any' | 'all';
  roleSource?: string;
  public?: boolean;
  skipExpiryCheck?: boolean;
}

export const ROUTE_RULES: RouteRule[] = [
  // Public
  { pattern: '/login', public: true },
  { pattern: '/callback', public: true },
  { pattern: '/health', public: true },
  { pattern: '/health/**', public: true },
  { pattern: '/api/auth/backchannel-logout', public: true },

  // Auth
  { pattern: '/api/me', session: true },
  { pattern: '/api/auth/refresh', session: true, csrf: true, skipExpiryCheck: true },

  // Proxy: mutations need CSRF, all skip expiry check (HttpClient handles refresh)
  { pattern: '/api/service/**', method: ['POST', 'PUT', 'DELETE', 'PATCH'], session: true, csrf: true, skipExpiryCheck: true },
  { pattern: '/api/service/**', session: true, skipExpiryCheck: true },

  // Logout – allow even if access token expired (still requires valid session & CSRF)
  { pattern: '/logout', session: true, csrf: true, skipExpiryCheck: true },
];