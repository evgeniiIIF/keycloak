/**
 * Полный OAuth flow через BFF.
 *
 * Что проверяем:
 *   - Успешный логин: /login → Keycloak → форма → /callback → сессия → /api/me.
 *   - Неверный пароль → Keycloak показывает ошибку.
 *   - Несуществующий пользователь → Keycloak показывает ошибку.
 */

import { expect,test } from '@playwright/test';

import { expectLoginError,loginViaUi } from '../helpers/auth.helper';
import { KEYCLOAK_SELECTORS } from '../helpers/selectors';

const TEST_USER = process.env.TEST_USER || 'testuser';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123';

test.describe('Login', () => {
  test('Successful Login: should complete full OAuth flow and create session', async ({ page }) => {
    await test.step('Открываем /login — BFF редиректит на Keycloak', async () => {
      await page.goto('/login');
      expect(page.url()).toContain('/realms/TestRealm/protocol/openid-connect/auth');
    });

    await test.step('Логинимся через форму Keycloak', async () => {
      await loginViaUi(page, TEST_USER, TEST_PASSWORD);
    });

    await test.step('Ждём возврат на BFF', async () => {
      await page.waitForURL(url => !url.href.includes('/auth'));
    });

    // Проверяем, что BFF установил обе cookie: сессию и CSRF-токен.
    await test.step('Проверяем cookies', async () => {
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'connect.sid');
      const csrfCookie = cookies.find(c => c.name === 'XSRF-TOKEN');
      expect(sessionCookie).toBeDefined();
      expect(csrfCookie).toBeDefined();
    });

    // Обращаемся к /api/me — проверяем, что сессия работает и данные верные.
    await test.step('Проверяем доступ к /api/me', async () => {
      const response = await page.request.get('/api/me');
      expect(response.status()).toBe(200);
      const userData = await response.json();
      expect(userData.user.username).toBe(TEST_USER);
    });
  });

  test('Failed Login: wrong password should show error', async ({ page }) => {
    await test.step('Открываем /login', async () => {
      await page.goto('/login');
    });

    // Вводим верный логин, но неверный пароль.
    // Ожидаем, что Keycloak не пустит и вернёт ошибку.
    await test.step('Пробуем войти с неверным паролем', async () => {
      await page.fill(KEYCLOAK_SELECTORS.usernameInput, TEST_USER);
      await page.fill(KEYCLOAK_SELECTORS.passwordInput, 'wrong-password-123');
      await page.click(KEYCLOAK_SELECTORS.submitButton);
    });

    // Keycloak показывает «Invalid username or password».
    await test.step('Проверяем сообщение об ошибке', async () => {
      await expectLoginError(page, /Invalid username or password/i);
    });
  });

  test('Failed Login: non-existent user should show error', async ({ page }) => {
    await test.step('Открываем /login', async () => {
      await page.goto('/login');
    });

    // Вводим несуществующего пользователя.
    // Ожидаем ту же ошибку, что и при неверном пароле — Keycloak не раскрывает, что не так.
    await test.step('Пробуем войти как несуществующий пользователь', async () => {
      await page.fill(KEYCLOAK_SELECTORS.usernameInput, 'non-existent-user-999');
      await page.fill(KEYCLOAK_SELECTORS.passwordInput, TEST_PASSWORD);
      await page.click(KEYCLOAK_SELECTORS.submitButton);
    });

    await test.step('Проверяем сообщение об ошибке', async () => {
      await expectLoginError(page, /Invalid username or password/i);
    });
  });
});
