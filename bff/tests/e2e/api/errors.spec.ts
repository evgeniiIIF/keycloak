/**
 * Обработка ошибок авторизации в BFF.
 *
 * Что проверяем:
 *   - Запросы без сессии → 401.
 *   - Запросы с несуществующей сессией → 401.
 *   - Callback с ошибкой → 302-редирект на /login с error=.
 */

import { expect,test } from '@playwright/test';

test.describe('Authorization Errors', () => {
  // Очищаем cookies — сессии нет.
  // Отправляем GET /api/me.
  // Ожидаем 401.
  test('GET /api/me without session cookie should return 401', async ({ page }) => {
    await page.context().clearCookies();

    const response = await page.request.get('/api/me');
    expect(response.status()).toBe(401);
  });

  // Подставляем cookie с несуществующим session id.
  // Ожидаем 401 — сессии нет в Redis.
  test('GET /api/me with nonexistent session should return 401', async ({ page }) => {
    await page.context().addCookies([{
      name: 'connect.sid',
      value: 'non-existent-session-id',
      domain: 'localhost',
      path: '/',
    }]);

    const response = await page.request.get('/api/me');
    expect(response.status()).toBe(401);
  });

  // Отправляем callback с невалидным state.
  // НЕ следуем за редиректом (maxRedirects: 0), чтобы не идти на фронтенд.
  // Ожидаем 302 и Location с /login?error=.
  test('GET /callback with invalid state should redirect to login with error', async ({ page }) => {
    const response = await page.request.get('/callback?code=somecode&state=invalid_state', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(302);
    const location = response.headers()['location'];
    expect(location).toContain('/login');
    expect(location).toContain('error=');
  });

  // Без code → тот же редирект с ошибкой.
  test('GET /callback without code should redirect to login with error', async ({ page }) => {
    const response = await page.request.get('/callback?state=some_state', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(302);
    const location = response.headers()['location'];
    expect(location).toContain('/login');
    expect(location).toContain('error=');
  });

  // Keycloak вернул error=access_denied → BFF редиректит с ошибкой.
  test('GET /callback with error=access_denied should redirect to login with error', async ({ page }) => {
    const response = await page.request.get('/callback?error=access_denied', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(302);
    const location = response.headers()['location'];
    expect(location).toContain('/login');
    expect(location).toContain('error=');
  });
});
