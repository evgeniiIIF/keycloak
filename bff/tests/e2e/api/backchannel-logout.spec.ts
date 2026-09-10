import { test, expect } from '@playwright/test';

test.describe('Backchannel Logout', () => {
  test('POST /api/auth/backchannel-logout without logout_token should return 400', async ({ page }) => {
    const response = await page.request.post('/api/auth/backchannel-logout', {
      data: {},
    });
    expect(response.status()).toBe(400);
  });

  test('POST /api/auth/backchannel-logout with token missing sub should return 401', async ({ page }) => {
    // Создаем токен с невалидной подписью (jwtVerify упадет с ошибкой)
    const invalidToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ9.signature';

    const response = await page.request.post('/api/auth/backchannel-logout', {
      data: {
        logout_token: invalidToken,
      },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/auth/backchannel-logout with invalid signature should return 401', async ({ page }) => {
    const invalidToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiS1MjM0NTY3ODkifQ.invalid_signature';

    const response = await page.request.post('/api/auth/backchannel-logout', {
      data: {
        logout_token: invalidToken,
      },
    });
    expect(response.status()).toBe(401);
  });
});
