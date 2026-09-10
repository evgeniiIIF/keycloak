import { test, expect } from '@playwright/test';
import { loginViaUi } from '../helpers/auth.helper';

const TEST_USER = process.env.TEST_USER || 'testuser';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123';

test.describe('Logout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await loginViaUi(page, TEST_USER, TEST_PASSWORD);
    await page.waitForURL(url => !url.href.includes('/auth'));
  });

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

    // Проверяем, что сессия больше не работает
    const meResponse = await page.request.get('/api/me');
    expect(meResponse.status()).toBe(401);
  });
});
