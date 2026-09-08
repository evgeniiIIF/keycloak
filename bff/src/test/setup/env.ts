/**
 * Единственное место установки переменных окружения для всех тестов.
 * Функция setTestEnv вызывается автоматически при загрузке этого файла
 * (через jest setupFiles), а также из integration-setup.ts.
 *
 * @param overrides - дополнительные переменные, которые становятся известны
 *                    после запуска контейнеров (порты, URL)
 */
export function setTestEnv(overrides?: Record<string, string>): void {
  // === Базовые настройки приложения ===
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3000';
  process.env.SESSION_SECRET = 'integration-test-secret-key-with-at-least-32-characters';
  process.env.SESSION_TTL = '60';
  process.env.SESSION_COOKIE_NAME = 'connect.sid';
  process.env.SESSION_PREFIX = 'test:';
  process.env.OAUTH_STATE_TTL = '60';
  process.env.FRONTEND_URL = 'http://localhost:8082';
  process.env.PROTECTED_SERVICE_URL = 'http://protected-service:8080';

  // === Keycloak ===
  process.env.KEYCLOAK_CLIENT_ID = 'bff-client';
  process.env.KEYCLOAK_CLIENT_SECRET = 'AQce4SdHum6sxqnreawz3ArsKm4tIx47';
  process.env.KEYCLOAK_ISSUER = 'http://localhost:8080/realms/TestRealm';
  process.env.KEYCLOAK_PUBLIC_ISSUER = 'http://localhost:8080/realms/TestRealm';
  process.env.KEYCLOAK_REDIRECT_URI = 'http://localhost:3000/callback';
  process.env.KEYCLOAK_LOGOUT_REDIRECT_URI = 'http://localhost:8082/';

  // === Redis ===
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';

  // === Динамические переменные (порты контейнеров) ===
  if (overrides) {
    Object.entries(overrides).forEach(([key, value]) => {
      process.env[key] = value;
    });
  }
}

// Автоматически вызываем при загрузке файла (для unit-тестов через setupFiles)
setTestEnv();
