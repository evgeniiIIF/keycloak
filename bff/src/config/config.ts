import * as dotenv from 'dotenv';

dotenv.config();

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    'SESSION_SECRET must be >= 32 chars. Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}

const DEFAULT_FRONTEND = 'http://localhost:8082';

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || DEFAULT_FRONTEND,
  protectedServiceUrl: process.env.PROTECTED_SERVICE_URL || 'http://protected-service:8080',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : [process.env.FRONTEND_URL || DEFAULT_FRONTEND],
  session: {
    secret: sessionSecret,
    prefix: process.env.SESSION_PREFIX || 'sess:',
    ttl: parseInt(process.env.SESSION_TTL || '86400', 10),
  },
  keycloak: {
    issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/TestRealm',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'bff-client',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
    redirectUri: process.env.KEYCLOAK_REDIRECT_URI || 'http://localhost:3000/callback',
  },
  redis: {
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
    password: process.env.REDIS_PASSWORD || undefined,
  },
} as const;
