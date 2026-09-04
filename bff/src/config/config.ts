import * as dotenv from 'dotenv';

dotenv.config();

// Helper to ensure environment variables are present
function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required but was not found.`);
  }
  return value;
}

function getEnvInt(name: string): number {
  const value = getEnv(name);
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number.`);
  }
  return parsed;
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    'SESSION_SECRET must be >= 32 chars. Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}

const port = getEnvInt('PORT');
const sessionTtl = getEnvInt('SESSION_TTL');
const nodeEnv = getEnv('NODE_ENV');
const clientSecret = getEnv('KEYCLOAK_CLIENT_SECRET');

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port,
  frontendUrl: getEnv('FRONTEND_URL'),
  protectedServiceUrl: getEnv('PROTECTED_SERVICE_URL'),
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : [getEnv('FRONTEND_URL')],
  session: {
    secret: sessionSecret,
    cookieName: getEnv('SESSION_COOKIE_NAME'),
    prefix: getEnv('SESSION_PREFIX'),
    ttl: sessionTtl,
    oauthStateTtl: getEnvInt('OAUTH_STATE_TTL'),
  },
  keycloak: {
    issuer: getEnv('KEYCLOAK_ISSUER'),
    publicIssuer: process.env.KEYCLOAK_PUBLIC_ISSUER || getEnv('KEYCLOAK_ISSUER'),
    clientId: getEnv('KEYCLOAK_CLIENT_ID'),
    clientSecret,
    redirectUri: getEnv('KEYCLOAK_REDIRECT_URI'),
    logoutRedirectUri: getEnv('KEYCLOAK_LOGOUT_REDIRECT_URI'),
  },
  redis: {
    url:
      process.env.REDIS_URL ||
      `${process.env.REDIS_TLS === 'true' ? 'rediss' : 'redis'}://${getEnv('REDIS_HOST')}:${getEnv('REDIS_PORT')}`,
    password: process.env.REDIS_PASSWORD || undefined,
  },
} as const;
