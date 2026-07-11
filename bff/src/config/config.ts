import * as dotenv from 'dotenv';

dotenv.config();

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    'SESSION_SECRET must be >= 32 chars. Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}

const port = parseInt(process.env.PORT || '3000', 10);
if (Number.isNaN(port)) {
  throw new Error('PORT must be a number');
}

const sessionTtl = parseInt(process.env.SESSION_TTL || '86400', 10);
if (Number.isNaN(sessionTtl)) {
  throw new Error('SESSION_TTL must be a number');
}

const DEFAULT_FRONTEND = 'http://localhost:8082';

const nodeEnv = process.env.NODE_ENV || 'development';

const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';
if (nodeEnv === 'production' && !clientSecret) {
  throw new Error('KEYCLOAK_CLIENT_SECRET is required in production');
}

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port,
  frontendUrl: process.env.FRONTEND_URL || DEFAULT_FRONTEND,
  protectedServiceUrl: process.env.PROTECTED_SERVICE_URL || 'http://protected-service:8080',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : [process.env.FRONTEND_URL || DEFAULT_FRONTEND],
  session: {
    secret: sessionSecret,
    cookieName: process.env.SESSION_COOKIE_NAME || 'connect.sid',
    prefix: process.env.SESSION_PREFIX || 'sess:',
    ttl: sessionTtl,
  },
  keycloak: {
    issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/TestRealm',
    publicIssuer: process.env.KEYCLOAK_PUBLIC_ISSUER || process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/TestRealm',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'bff-client',
    clientSecret,
    redirectUri: process.env.KEYCLOAK_REDIRECT_URI || 'http://localhost:3000/callback',
    logoutRedirectUri: process.env.KEYCLOAK_LOGOUT_REDIRECT_URI || `http://localhost:${port}/login`,
  },
  redis: {
    url:
      process.env.REDIS_URL ||
      `${process.env.REDIS_TLS === 'true' ? 'rediss' : 'redis'}://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
    password: process.env.REDIS_PASSWORD || undefined,
  },
} as const;
