/**
 * Logout в BFF.
 *
 * Что проверяем:
 *   - POST /logout с валидной сессией и CSRF → возвращает URL выхода из Keycloak.
 *   - После logout сессия уничтожена — /api/me возвращает 401.
 */

import { expect,test } from '@playwright/test';

import { loginViaUi } from '../helpers/auth.helper';

const TEST_USER = process.env.TEST_USER || 'testuser';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123';

test.describe('Logout', () => {
  // Логинимся, чтобы получить сессию и CSRF-cookie.
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await loginViaUi(page, TEST_USER, TEST_PASSWORD);
    await page.waitForURL(url => !url.href.includes('/auth'));
  });

  // Читаем CSRF-cookie, отправляем POST /logout с токеном.
  // Ожидаем 200 и logoutUrl в ответе.
  // Затем проверяем, что /api/me больше не работает → 401.
  test('POST /logout should clear session and return logoutUrl', async ({ page }) => {
    const cookies = await page.context().cookies();
    const csrfCookie = cookies.find(c => c.name === 'XSRF-TOKEN');

    const response = await page.request.post('/logout', {
      headers: {
        'X-CSRF-Token': csrfCookie!.value,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('logoutUrl');

    // Сессия удалена — BFF больше не авторизует запросы.
    const meResponse = await page.request.get('/api/me');
    expect(meResponse.status()).toBe(401);
  });
});
