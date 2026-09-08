import { startRedisContainer } from '../containers/redis-container';
import { startKeycloakContainer } from '../containers/keycloak-container';
import { setTestEnv } from './env';

/**
 * Запускается один раз перед всеми integration-тестами.
 * Запускает Docker-контейнеры (Redis, Keycloak) и настраивает переменные окружения.
 */
export default async function integrationSetup(): Promise<void> {
  console.log('🚀 Проверяем/запускаем контейнеры...');

  const [redisContainer, keycloakContainer] = await Promise.all([
    startRedisContainer(),
    startKeycloakContainer(),
  ]);

  const keycloakPort = keycloakContainer.getMappedPort(8080);
  const keycloakBaseUrl = `http://localhost:${keycloakPort}`;

  setTestEnv({
    REDIS_HOST: redisContainer.getHost(),
    REDIS_PORT: String(redisContainer.getMappedPort(6379)),
    KEYCLOAK_ISSUER: `${keycloakBaseUrl}/realms/TestRealm`,
    KEYCLOAK_PUBLIC_ISSUER: `${keycloakBaseUrl}/realms/TestRealm`,
  });

  console.log('✅ Готово к тестам');
}
