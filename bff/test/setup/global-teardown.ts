export default async function globalTeardown(): Promise<void> {
  // Контейнеры НЕ останавливаем благодаря withReuse()
  console.log('✅ Тесты завершены. Контейнеры продолжают работать.');
  console.log('🛑 Для остановки: docker rm -f test-redis test-keycloak');
}
