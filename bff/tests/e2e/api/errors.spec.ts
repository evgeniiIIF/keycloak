import { test, expect } from '@playwright/test';

test.describe('Authorization Errors', () => {
  test('GET /api/me without session cookie should return 401', async ({ page }) => {
    // Очищаем все куки текущего контекста
    await page.context().clearCookies();

    const response = await page.request.get('/api/me');
    expect(response.status()).toBe(401);
  });

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

  test('GET /callback with invalid state should redirect to login with error', async ({ page }) => {
    await page.goto('/callback?code=somecode&state=invalid_state');

    // Ожидаем редирект на /login с ошибкой
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('error=');
  });

  test('GET /callback without code should redirect to login with error', async ({ page }) => {
    await page.goto('/callback?state=some_state');

    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('error=');
  });

  test('GET /callback with error=access_denied should redirect to login with error', async ({ page }) => {
    await page.goto('/callback?error=access_denied');

    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('error=');
  });
});
