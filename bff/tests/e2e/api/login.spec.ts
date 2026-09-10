import { test, expect } from '@playwright/test';
import { loginViaUi, expectLoginError } from '../helpers/auth.helper';

const TEST_USER = process.env.TEST_USER || 'testuser';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123';

test.describe('Login', () => {
  test('Successful Login: should complete full OAuth flow and create session', async ({ page }) => {
    await test.step('Redirect to Keycloak', async () => {
      await page.goto('/login');
      expect(page.url()).toContain('/realms/TestRealm/protocol/openid-connect/auth');
    });

    await test.step('Login via Keycloak UI', async () => {
      await loginViaUi(page, TEST_USER, TEST_PASSWORD);
    });

    await test.step('Return to BFF', async () => {
      await page.waitForURL(url => !url.href.includes('/auth'));
    });

    await test.step('Verify Session Cookies', async () => {
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'connect.sid');
      const csrfCookie = cookies.find(c => c.name === 'XSRF-TOKEN');
      expect(sessionCookie).toBeDefined();
      expect(csrfCookie).toBeDefined();
    });

    await test.step('Verify Access to /api/me', async () => {
      const response = await page.request.get('/api/me');
      expect(response.status()).toBe(200);
      const userData = await response.json();
      expect(userData.user.username).toBe(TEST_USER);
    });
  });

  test('Failed Login: wrong password should show error', async ({ page }) => {
    await test.step('Redirect to Keycloak', async () => {
      await page.goto('/login');
    });

    await test.step('Attempt login with wrong password', async () => {
      // Используем правильный логин, но заведомо неправильный пароль
      await page.fill('input[name="username"]', TEST_USER);
      await page.fill('input[name="password"]', 'wrong-password-123');
      await page.click('input[type="submit"]');
    });

    await test.step('Verify error message', async () => {
      // Проверяем, что Keycloak вывел ошибку (обычно это "Invalid username or password")
      await expectLoginError(page, /Invalid username or password/i);
    });
  });

  test('Failed Login: non-existent user should show error', async ({ page }) => {
    await test.step('Redirect to Keycloak', async () => {
      await page.goto('/login');
    });

    await test.step('Attempt login with non-existent user', async () => {
      await page.fill('input[name="username"]', 'non-existent-user-999');
      await page.fill('input[name="password"]', TEST_PASSWORD);
      await page.click('input[type="submit"]');
    });

    await test.step('Verify error message', async () => {
      await expectLoginError(page, /Invalid username or password/i);
    });
  });
});
