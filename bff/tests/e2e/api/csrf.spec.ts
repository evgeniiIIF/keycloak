import { test, expect } from '@playwright/test';
import { loginViaUi } from '../helpers/auth.helper';

const TEST_USER = process.env.TEST_USER || 'testuser';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password';

test.describe('CSRF Protection', () => {
  test.beforeEach(async ({ page }) => {
    // Авторизуемся перед каждым тестом, чтобы получить сессию и токены
    await page.goto('/login');
    await loginViaUi(page, TEST_USER, TEST_PASSWORD);
    await page.waitForURL(url => !url.pathname().includes('/auth'));
  });

  test('POST /logout without X-CSRF-Token should return 401', async ({ page }) => {
    const response = await page.request.post('/logout');
    expect(response.status()).toBe(401);
  });

  test('POST /logout with invalid token should return 401', async ({ page }) => {
    const response = await page.request.post('/logout', {
      headers: {
        'X-CSRF-Token': 'invalid-token-123',
      },
    });
    expect(response.status()).toBe(401);
  });

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

  test('GET request should not require CSRF token', async ({ page }) => {
    const response = await page.request.get('/api/me');
    expect(response.status()).toBe(200);
  });
});
