import { test, expect } from '@playwright/test';
import { loginViaUi } from '../helpers/auth.helper';

const TEST_USER = process.env.TEST_USER || 'testuser';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password';

test.describe('OAuth Flow', () => {
  test('should complete full OAuth flow and create session', async ({ page }) => {
    // 1. Переход на /login -> редирект в Keycloak
    await page.goto('/login');

    // Проверяем, что мы оказались на странице Keycloak (по URL)
    expect(page.url()).toContain('/realms/TestRealm/protocol/openid-connect/auth');

    // 2. Авторизация через форму Keycloak
    await loginViaUi(page, TEST_USER, TEST_PASSWORD);

    // 3. BFF обменивает code на токены и редиректит на / (или заданный default)
    // Ожидаем, что мы вернулись в BFF и URL теперь не содержит /auth
    await page.waitForURL(url => !url.pathname().includes('/auth'));

    // 4. Проверяем установку кук
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'connect.sid');
    const csrfCookie = cookies.find(c => c.name === 'XSRF-TOKEN');

    expect(sessionCookie).toBeDefined();
    expect(csrfCookie).toBeDefined();

    // 5. Проверяем доступ к защищенному ресурсу /api/me
    const response = await page.request.get('/api/me');
    expect(response.status()).toBe(200);

    const userData = await response.json();
    expect(userData).toHaveProperty('sub');
    expect(userData.preferred_username).toBe(TEST_USER);
  });
});
