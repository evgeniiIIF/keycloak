import { test, expect } from '@playwright/test';
import { KEYCLOAK_SELECTORS } from '../helpers/selectors';

test.describe('Login Form Visuals', () => {
  test.beforeEach(async ({ page }) => {
    // Переходим на страницу логина Keycloak
    // В реальном сценарии это происходит через /login BFF, но для UI-теста формы
    // можно идти напрямую на Keycloak, если мы знаем URL.
    // Однако лучше пойти через BFF, чтобы проверить весь флоу.
    await page.goto('/login');
  });

  test('should display all required fields and buttons', async ({ page }) => {
    await expect(page.locator(KEYCLOAK_SELECTORS.usernameInput)).toBeVisible();
    await expect(page.locator(KEYCLOAK_SELECTORS.passwordInput)).toBeVisible();
    await expect(page.locator(KEYCLOAK_SELECTORS.submitButton)).toBeVisible();
    await expect(page.locator(KEYCLOAK_SELECTORS.togglePasswordButton)).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.locator(KEYCLOAK_SELECTORS.passwordInput);
    const toggleBtn = page.locator(KEYCLOAK_SELECTORS.togglePasswordButton);

    // По умолчанию пароль скрыт
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Нажимаем показать
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Нажимаем скрыть
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should be responsive on mobile view', async ({ page }) => {
    // Меняем размер окна на мобильный
    await page.setViewportSize({ width: 375, height: 667 });

    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.locator(KEYCLOAK_SELECTORS.usernameInput)).toBeVisible();
    await expect(page.locator(KEYCLOAK_SELECTORS.submitButton)).toBeVisible();
  });
});
