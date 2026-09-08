import { GenericContainer, StartedTestContainer } from 'testcontainers';

export async function startRedisContainer(): Promise<StartedTestContainer> {
  return new GenericContainer('redis:7-alpine')
    .withName('test-redis')
    .withExposedPorts(6379)
    .withReuse() // Разрешаем переиспользование контейнера
    .start();
}
