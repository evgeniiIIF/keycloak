import { z } from 'zod';

// Схема переменных окружения BFF.
// Единственный источник правды: типы + валидация + дефолты.
// Валидируется один раз при старте — приложение не поднимется с некорректным env.
export const envSchema = z.object({
  // Окружение
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive(),

  // URLs
  FRONTEND_URL: z.string().url(),
  PROTECTED_SERVICE_URL: z.string().url(),
  CORS_ORIGINS: z.string().optional(),

  // Session
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_COOKIE_NAME: z.string().min(1),
  SESSION_PREFIX: z.string().min(1),
  SESSION_TTL: z.coerce.number().int().positive(),
  OAUTH_STATE_TTL: z.coerce.number().int().positive(),

  // Keycloak
  KEYCLOAK_ISSUER: z.string().url(),
  KEYCLOAK_PUBLIC_ISSUER: z.string().url().optional(),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),
  KEYCLOAK_REDIRECT_URI: z.string().url(),
  KEYCLOAK_LOGOUT_REDIRECT_URI: z.string().url(),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.enum(['true', 'false']).optional(),

  // Throttle
  THROTTLE_DEFAULT_LIMIT: z.coerce.number().int().positive(),
  THROTTLE_STRICT_LIMIT: z.coerce.number().int().positive(),
  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive(),
});

export type Env = z.infer<typeof envSchema>;

// Валидация с человекочитаемым выводом ошибок.
// Ошибка → process.exit(1), приложение не стартует с некорректным env.
export function validateEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
}
