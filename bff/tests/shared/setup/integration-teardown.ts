/**
 * Запускается один раз после всех integration-тестов.
 * Контейнеры НЕ останавливаем — они переиспользуются.
 */
export default async function integrationTeardown(): Promise<void> {
  console.log('✅ Тесты завершены. Контейнеры продолжают работать.');
  console.log('🛑 Для остановки: docker rm -f test-redis test-keycloak');
}
