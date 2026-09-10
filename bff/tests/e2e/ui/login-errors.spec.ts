import { test, expect } from '@playwright/test';
import { KEYCLOAK_SELECTORS } from '../helpers/selectors';
import { expectLoginError } from '../helpers/auth.helper';

test.describe('Login Form Errors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should show HTML5 validation for empty fields', async ({ page }) => {
    const submitBtn = page.locator(KEYCLOAK_SELECTORS.submitButton);

    // Очищаем поля (хотя они и так пустые)
    await page.fill(KEYCLOAK_SELECTORS.usernameInput, '');
    await page.fill(KEYCLOAK_SELECTORS.passwordInput, '');

    await submitBtn.click();

    // Проверяем, что форма не была отправлена (мы всё еще на странице логина)
    // И что браузер показывает валидацию (через атрибут required)
    const usernameInput = page.locator(KEYCLOAK_SELECTORS.usernameInput);
    await expect(usernameInput).toHaveAttribute('required', '');
  });

  test('should show Keycloak error for invalid password', async ({ page }) => {
    // Используем существующего пользователя, но неверный пароль
    await page.fill(KEYCLOAK_SELECTORS.usernameInput, 'testuser');
    await page.fill(KEYCLOAK_SELECTORS.passwordInput, 'wrong-password');
    await page.click(KEYCLOAK_SELECTORS.submitButton);

    // Ожидаем появления сообщения об ошибке от Keycloak
    // Текст ошибки зависит от настроек Keycloak, обычно "Invalid username or password"
    await expectLoginError(page, /Invalid username or password|Invalid credentials/i);
  });

  test('should show error for non-existent user', async ({ page }) => {
    await page.fill(KEYCLOAK_SELECTORS.usernameInput, 'non-existent-user-123');
    await page.fill(KEYCLOAK_SELECTORS.passwordInput, 'some-password');
    await page.click(KEYCLOAK_SELECTORS.submitButton);

    await expectLoginError(page, /Invalid username or password|Invalid credentials/i);
  });
});
