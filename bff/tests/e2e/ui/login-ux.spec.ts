/**
 * UX формы Keycloak.
 *
 * Что проверяем:
 *   - Enter в поле пароля отправляет форму.
 *   - Tab перемещает фокус по порядку: username → password → toggle → submit.
 *   - Ссылка "Forgot password?" ведёт на страницу восстановления (если включена).
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

  // Username в фокусе при загрузке.
  // Проверяем круговой Tab-loop: username → password → toggle → rememberMe → submit → username
  test('should have correct circular Tab order', async ({ page }) => {
    // Автофокус на username
    await expect(page.locator(KEYCLOAK_SELECTORS.usernameInput)).toBeFocused();

    // Tab → password
    await page.keyboard.press('Tab');
    await expect(page.locator(KEYCLOAK_SELECTORS.passwordInput)).toBeFocused();

    // Tab → toggle-password
    await page.keyboard.press('Tab');
    await expect(page.locator(KEYCLOAK_SELECTORS.togglePasswordButton)).toBeFocused();

    // Tab → remember-me
    await page.keyboard.press('Tab');
    await expect(page.locator(KEYCLOAK_SELECTORS.rememberMeCheckbox)).toBeFocused();

    // Tab → submit
    await page.keyboard.press('Tab');
    await expect(page.locator(KEYCLOAK_SELECTORS.submitButton)).toBeFocused();

    // Tab → wrap back to username
    await page.keyboard.press('Tab');
    await expect(page.locator(KEYCLOAK_SELECTORS.usernameInput)).toBeFocused();

    // Shift + Tab → wrap back to submit
    await page.keyboard.press({ modifier: 'Shift', key: 'Tab' });
    await expect(page.locator(KEYCLOAK_SELECTORS.submitButton)).toBeFocused();
  });

  // Кликаем "Forgot password?", если ссылка есть в DOM.
  // Ожидаем редирект на /login-actions/reset-credentials.
  test('should redirect to "Forgot password?" page if link is available', async ({ page }) => {
    const link = page.locator(KEYCLOAK_SELECTORS.forgotPasswordLink);

    if (await link.count() === 0) {
      test.skip();
      return;
    }

    await link.click();
    expect(page.url()).toContain('/login-actions/');
  });
});
