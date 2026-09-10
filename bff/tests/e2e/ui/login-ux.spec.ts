import { test, expect } from '@playwright/test';
import { KEYCLOAK_SELECTORS } from '../helpers/selectors';

test.describe('Login Form UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should submit form on Enter in password field', async ({ page }) => {
    await page.fill(KEYCLOAK_SELECTORS.usernameInput, 'testuser');
    await page.fill(KEYCLOAK_SELECTORS.passwordInput, 'password');

    // Нажимаем Enter
    await page.keyboard.press('Enter');

    // Проверяем, что началась отправка (например, кнопка стала disabled или URL изменился)
    // В нашем App.tsx кнопка становится disabled при loading
    await expect(page.locator(KEYCLOAK_SELECTORS.submitButton)).toBeDisabled();
  });

  test('should have correct Tab order', async ({ page }) => {
    // Фокус по умолчанию на username (автофокус)
    await expect(page.locator(KEYCLOAK_SELECTORS.usernameInput)).toBeFocused();

    // Tab -> Password
    await page.keyboard.press('Tab');
    await expect(page.locator(KEYCLOAK_SELECTORS.passwordInput)).toBeFocused();

    // Tab -> Toggle Password
    await page.keyboard.press('Tab');
    await expect(page.locator(KEYCLOAK_SELECTORS.togglePasswordButton)).toBeFocused();

    // Tab -> Submit
    await page.keyboard.press('Tab');
    await expect(page.locator(KEYCLOAK_SELECTORS.submitButton)).toBeFocused();
  });

  test('should redirect to "Forgot password?" page', async ({ page }) => {
    await page.click(KEYCLOAK_SELECTORS.forgotPasswordLink);

    // Проверяем редирект на страницу восстановления пароля Keycloak
    expect(page.url()).toContain('/auth/realms/TestRealm/login-actions/forgot-password');
  });
});
