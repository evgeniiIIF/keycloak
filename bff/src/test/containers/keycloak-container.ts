import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import path from 'path';

export async function startKeycloakContainer(): Promise<StartedTestContainer> {
  const realmFilePath = path.resolve(__dirname, '../fixtures/realm-test.json');
  const importDir = '/opt/keycloak/data/import';

  return new GenericContainer('quay.io/keycloak/keycloak:26.6')
    .withName('test-keycloak')
    .withExposedPorts(8080)
    .withEnvironment({
      KC_BOOTSTRAP_ADMIN_USERNAME: 'admin',
      KC_BOOTSTRAP_ADMIN_PASSWORD: 'admin',
      KC_DB: 'dev-file',
      KC_HTTP_PORT: '8080',
      KC_HOSTNAME_STRICT: 'false',
      KC_HOSTNAME: 'localhost',
    })
    .withCommand(['start-dev', '--import-realm'])
    .withBindMounts([
      {
        source: realmFilePath,
        target: `${importDir}/realm-test.json`,
        mode: 'ro',
      },
    ])
    .withWaitStrategy(
      Wait.forHttp('/realms/TestRealm/.well-known/openid-configuration', 8080)
        .withStartupTimeout(1800000),
    )
    .withStartupTimeout(1800000)
    .withReuse() // Разрешаем переиспользование контейнера
    .start();
}
