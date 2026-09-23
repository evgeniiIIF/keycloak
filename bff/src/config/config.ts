import * as dotenv from 'dotenv';

import { Env, validateEnv } from './env.schema';

// Загружаем .env до валидации схемы.
dotenv.config({ quiet: true });

// Валидируем и типизируем переменные окружения.
// Если чего-то не хватает или формат неверный — process.exit(1) до старта приложения.
const env: Env = validateEnv(process.env);

// Собираем URL Redis из частей, если не задан целиком.
function buildRedisUrl(): string {
  if (env.REDIS_URL) return env.REDIS_URL;
  const protocol = env.REDIS_TLS === 'true' ? 'rediss' : 'redis';
  const host = env.REDIS_HOST ?? 'localhost';
  const port = env.REDIS_PORT ?? 6379;
  return `${protocol}://${host}:${port}`;
}

// Собираем список CORS origins из строки через запятую.
function buildCorsOrigins(): string[] {
  if (!env.CORS_ORIGINS) return [env.FRONTEND_URL];
  return env.CORS_ORIGINS.split(',').map((s) => s.trim());
}

// Итоговый конфиг приложения.
// Тип AppConfig — единый источник правды для DI-обёртки AppConfigService.
export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  frontendUrl: env.FRONTEND_URL,
  protectedServiceUrl: env.PROTECTED_SERVICE_URL,
  corsOrigins: buildCorsOrigins(),
  session: {
    secret: env.SESSION_SECRET,
    cookieName: env.SESSION_COOKIE_NAME,
    prefix: env.SESSION_PREFIX,
    ttl: env.SESSION_TTL,
    oauthStateTtl: env.OAUTH_STATE_TTL,
  },
  keycloak: {
    issuer: env.KEYCLOAK_ISSUER,
    publicIssuer: env.KEYCLOAK_PUBLIC_ISSUER ?? env.KEYCLOAK_ISSUER,
    clientId: env.KEYCLOAK_CLIENT_ID,
    clientSecret: env.KEYCLOAK_CLIENT_SECRET,
    redirectUri: env.KEYCLOAK_REDIRECT_URI,
    logoutRedirectUri: env.KEYCLOAK_LOGOUT_REDIRECT_URI,
  },
  redis: {
    url: buildRedisUrl(),
    password: env.REDIS_PASSWORD,
  },
  throttle: {
    defaultLimit: env.THROTTLE_DEFAULT_LIMIT,
    strictLimit: env.THROTTLE_STRICT_LIMIT,
    ttlSeconds: env.THROTTLE_TTL_SECONDS,
  },
} as const;

export type AppConfig = typeof config;
