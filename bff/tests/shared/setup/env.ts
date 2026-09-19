import * as dotenv from 'dotenv';

// Загружаем .env до всего остального, без баннера.
// quiet: true поддерживается в dotenv 17+.
dotenv.config({ quiet: true });

// NODE_ENV=test по умолчанию для всех тестов
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

/**
 * Переопределяет переменные окружения для integration-тестов.
 * Вызывается после старта testcontainers — подменяет хосты/порты на реальные,
 * которые выдал Docker. dotenv уже загружен, поэтому перезапись идёт напрямую.
 */
export function setTestEnv(overrides: Record<string, string>): void {
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}
