import { expect,test } from '@playwright/test';

import { KEYCLOAK_SELECTORS } from '../helpers/selectors';
import { injectTestInfo } from './ui-helpers';

test.describe('Login Form Visuals', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto('/login');
    await injectTestInfo(page, testInfo.title);
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
