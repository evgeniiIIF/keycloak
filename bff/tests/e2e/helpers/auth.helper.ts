import { Page, expect } from '@playwright/test';
import { KEYCLOAK_SELECTORS } from './selectors';

/**
 * Проходит процесс авторизации через UI форму Keycloak
 */
export async function loginViaUi(page: Page, username: string, password: string) {
  console.log(`[DEBUG] Starting login for user: ${username}`);

  // Слушаем консоль браузера для отлова ошибок JS
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[BROWSER ERROR] ${msg.text()}`);
    }
  });

  // Ожидаем загрузки полей формы
  await page.waitForSelector(KEYCLOAK_SELECTORS.usernameInput);
  console.log('[DEBUG] Login form loaded');

  // Вводим данные
  await page.fill(KEYCLOAK_SELECTORS.usernameInput, username);
  await page.fill(KEYCLOAK_SELECTORS.passwordInput, password);
  console.log('[DEBUG] Credentials entered');

  // Нажимаем кнопку входа
  console.log('[DEBUG] Clicking submit button');
  await page.click(KEYCLOAK_SELECTORS.submitButton);

  // Ждем либо успешного редиректа, либо появления ошибки
  try {
    await Promise.race([
      page.waitForURL(url => url.href.includes('/callback') || !url.href.includes('/auth')),
      page.waitForSelector(KEYCLOAK_SELECTORS.errorMessage, { timeout: 10000 }).then(() => {
        throw new Error(`Login failed: ${KEYCLOAK_SELECTORS.errorMessage} appeared`);
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Diagnostic timeout: no redirect or error after 10s')), 10000))
    ]);
    console.log('[DEBUG] Navigation successful');
  } catch (e: any) {
    const currentUrl = page.url();
    const errorText = await page.locator(KEYCLOAK_SELECTORS.errorMessage).innerText().catch(() => 'No error message found');
    console.log(`[DEBUG] Wait failed. Current URL: ${currentUrl}`);
    console.log(`[DEBUG] Error element text: ${errorText}`);
    throw e;
  }
}

/**
 * Проверяет наличие ошибки на форме логина
 */
export async function expectLoginError(page: Page, expectedText: string | RegExp) {
  const errorEl = page.locator(KEYCLOAK_SELECTORS.errorMessage);
  await expect(errorEl).toBeVisible();
  await expect(errorEl).toHaveText(expectedText);
}
