/**
 * UX формы Keycloak.
 *
 * Что проверяем:
 *   - Enter в поле пароля отправляет форму.
 *   - Естественный порядок Tab: username → password → toggle → rememberMe → submit.
 */

import { expect,test } from '@playwright/test';

import { KEYCLOAK_SELECTORS } from '../helpers/selectors';
import { injectTestInfo } from './ui-helpers';

test.describe('Login Form UX', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto('/login');
    await injectTestInfo(page, testInfo.title);
  });

  // Вводим логин и пароль, нажимаем Enter.
  // Ожидаем переход на /login-actions/authenticate — форма отправилась.
  test('should submit form on Enter in password field', async ({ page }) => {
    await page.fill(KEYCLOAK_SELECTORS.usernameInput, 'testuser');
    await page.fill(KEYCLOAK_SELECTORS.passwordInput, 'password');

    await page.keyboard.press('Enter');

    await page.waitForURL(url => url.href.includes('/login-actions/authenticate'), {
      timeout: 10000,
    });
  });

  // Проверяем естественный Tab-order:
  // username → password → toggle → rememberMe (если есть) → submit
  test('should have correct natural Tab order', async ({ page }) => {
    // Стартовая позиция — username (autofocus)
    await expect(page.locator(KEYCLOAK_SELECTORS.usernameInput)).toBeFocused();

    // Tab → password
    await page.keyboard.press('Tab');
    await expect(page.locator(KEYCLOAK_SELECTORS.passwordInput)).toBeFocused();

    // Tab → toggle-password
    await page.keyboard.press('Tab');
    await expect(page.locator(KEYCLOAK_SELECTORS.togglePasswordButton)).toBeFocused();

    // Если rememberMe есть в DOM — следующий Tab туда
    const rememberMe = page.locator(KEYCLOAK_SELECTORS.rememberMeCheckbox);
    if (await rememberMe.count() > 0) {
      await page.keyboard.press('Tab');
      await expect(rememberMe).toBeFocused();
    }

    // Финальный Tab → submit
    await page.keyboard.press('Tab');
    await expect(page.locator(KEYCLOAK_SELECTORS.submitButton)).toBeFocused();
  });

});
