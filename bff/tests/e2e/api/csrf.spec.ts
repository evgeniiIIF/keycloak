/**
 * CSRF-защита BFF.
 *
 * Сценарий: после логина BFF кладёт CSRF-токен в cookie XSRF-TOKEN.
 * Фронтенд при POST/PUT/DELETE отправляет его в заголовке X-CSRF-Token.
 * BFF сверяет заголовок с токеном в сессии.
 *
 * Что проверяем:
 *   - Без токена → 401 (защита от подделки запросов с чужого сайта).
 *   - Неверный токен → 401.
 *   - Верный токен → 200.
 *   - GET без токена → 200 (GET не меняет состояние).
 */

import { expect,test } from '@playwright/test';

import { loginViaUi } from '../helpers/auth.helper';

const TEST_USER = process.env.TEST_USER || 'testuser';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123';

test.describe('CSRF Protection', () => {
  // Логинимся, чтобы получить сессию и cookie XSRF-TOKEN.
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await loginViaUi(page, TEST_USER, TEST_PASSWORD);
    await page.waitForURL(url => !url.href.includes('/auth'));
  });

  // Отправляем POST без заголовка X-CSRF-Token.
  // Ожидаем 401 — BFF должен отклонить запрос.
  test('POST /logout without X-CSRF-Token should return 401', async ({ page }) => {
    const response = await page.request.post('/logout');
    expect(response.status()).toBe(401);
  });

  // Отправляем POST с заведомо неверным токеном.
  // Ожидаем 401 — BFF сверяет токен с сессией, а не просто проверяет наличие.
  test('POST /logout with invalid token should return 401', async ({ page }) => {
    const response = await page.request.post('/logout', {
      headers: {
        'X-CSRF-Token': 'invalid-token-123',
      },
    });
    expect(response.status()).toBe(401);
  });

  // Читаем cookie XSRF-TOKEN, которую BFF установил при логине.
  // Отправляем POST с этим токеном.
  // Ожидаем 200 — токен совпадает с сессией.
  test('POST /logout with valid token should return 200', async ({ page }) => {
    const cookies = await page.context().cookies();
    const csrfCookie = cookies.find(c => c.name === 'XSRF-TOKEN');

    expect(csrfCookie).toBeDefined();

    const response = await page.request.post('/logout', {
      headers: {
        'X-CSRF-Token': csrfCookie!.value,
      },
    });
    expect(response.status()).toBe(200);
  });

  // Отправляем GET без CSRF-токена.
  // Ожидаем 200 — GET не меняет состояние, защита не нужна.
  test('GET request should not require CSRF token', async ({ page }) => {
    const response = await page.request.get('/api/me');
    expect(response.status()).toBe(200);
  });
});
