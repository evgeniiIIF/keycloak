/**
 * Ошибки ввода на форме Keycloak.
 *
 * Что проверяем:
 *   - HTML5-валидация не даёт отправить пустую форму.
 *   - Keycloak показывает ошибку при неверных данных.
 */

import { expect,test } from '@playwright/test';

import { expectLoginError } from '../helpers/auth.helper';
import { KEYCLOAK_SELECTORS } from '../helpers/selectors';
import { injectTestInfo } from './ui-helpers';

test.describe('Login Form Errors', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto('/login');
    await injectTestInfo(page, testInfo.title);
  });

  // Нажимаем submit с пустыми полями.
  // Ожидаем, что браузер не даёт отправить — поле username invalid.
  test('should show HTML5 validation for empty fields', async ({ page }) => {
    await page.click(KEYCLOAK_SELECTORS.submitButton);

    // Остаёмся на той же странице — форма не отправилась.
    expect(page.url()).toContain('/realms/TestRealm/protocol/openid-connect/auth');

    // Поле username помечено как invalid браузером.
    const usernameInput = page.locator(KEYCLOAK_SELECTORS.usernameInput);
    const isInvalid = await usernameInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(isInvalid).toBe(true);
  });

  // Вводим существующий логин и неверный пароль.
  // Ожидаем алерт "Invalid username or password".
  test('should show Keycloak error for invalid password', async ({ page }) => {
    await page.fill(KEYCLOAK_SELECTORS.usernameInput, 'testuser');
    await page.fill(KEYCLOAK_SELECTORS.passwordInput, 'wrong-password');
    await page.click(KEYCLOAK_SELECTORS.submitButton);

    await expectLoginError(page, /Invalid username or password|Invalid credentials/i);
  });

  // Вводим несуществующего пользователя.
  // Ожидаем ту же ошибку — Keycloak не раскрывает детали.
  test('should show error for non-existent user', async ({ page }) => {
    await page.fill(KEYCLOAK_SELECTORS.usernameInput, 'non-existent-user-123');
    await page.fill(KEYCLOAK_SELECTORS.passwordInput, 'some-password');
    await page.click(KEYCLOAK_SELECTORS.submitButton);

    await expectLoginError(page, /Invalid username or password|Invalid credentials/i);
  });
});
