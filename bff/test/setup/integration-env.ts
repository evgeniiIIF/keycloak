/**
 * Устанавливает переменные окружения для интеграционных тестов.
 * Значения подобраны так, чтобы не зависеть от внешних .env файлов.
 */
export function setIntegrationEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3000';
  // Секрет сессии должен быть не короче 32 символов
  process.env.SESSION_SECRET = 'integration-test-secret-key-with-at-least-32-characters';
  process.env.SESSION_TTL = '60';       // 60 секунд – достаточно для тестов
  process.env.SESSION_COOKIE_NAME = 'connect.sid';
  process.env.SESSION_PREFIX = 'test:';
  process.env.OAUTH_STATE_TTL = '60';
  process.env.FRONTEND_URL = 'http://localhost:8082';
  process.env.PROTECTED_SERVICE_URL = 'http://protected-service:8080';
}
