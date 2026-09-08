import { startRedisContainer } from '../containers/redis-container';
import { startKeycloakContainer } from '../containers/keycloak-container';
import { setIntegrationEnv } from './integration-env';
import * as dotenv from 'dotenv';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  setIntegrationEnv();

  // Загружаем .env из корня bff/
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

  console.log('🚀 Проверяем/запускаем контейнеры...');

  const [redisContainer, keycloakContainer] = await Promise.all([
    startRedisContainer(),
    startKeycloakContainer(),
  ]);

  process.env.REDIS_HOST = redisContainer.getHost();
  process.env.REDIS_PORT = String(redisContainer.getMappedPort(6379));

  const keycloakHost = keycloakContainer.getHost();
  const keycloakPort = keycloakContainer.getMappedPort(8080);
  const keycloakBaseUrl = `http://${keycloakHost}:${keycloakPort}`;

  process.env.KEYCLOAK_ISSUER = `${keycloakBaseUrl}/realms/TestRealm`;
  process.env.KEYCLOAK_PUBLIC_ISSUER = `${keycloakBaseUrl}/realms/TestRealm`;
  
  // Берём client secret из .env
  process.env.KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'bff-client';
  process.env.KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';
  process.env.KEYCLOAK_REDIRECT_URI = process.env.KEYCLOAK_REDIRECT_URI || 'http://localhost:3000/callback';
  process.env.KEYCLOAK_LOGOUT_REDIRECT_URI = process.env.KEYCLOAK_LOGOUT_REDIRECT_URI || 'http://localhost:8082/';

  console.log('✅ Готово к тестам');
}
