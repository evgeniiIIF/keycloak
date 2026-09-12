/**
 * Backchannel logout в BFF.
 *
 * Keycloak отправляет POST с logout_token (JWT) при выходе пользователя
 * из другого клиента. BFF проверяет подпись по JWKS, jti на replay,
 * затем удаляет все сессии пользователя.
 *
 * Что проверяем:
 *   - Без logout_token → 400.
 *   - С невалидным токеном → 401 (jose бросает ошибку, BFF оборачивает).
 *   - С токеном без корректной подписи → 401.
 */

import { expect,test } from '@playwright/test';

test.describe('Backchannel Logout', () => {
  // Отправляем пустое тело.
  // Ожидаем 400 — DTO валидация требует logout_token.
  test('without logout_token should return 400', async ({ page }) => {
    const response = await page.request.post('/api/auth/backchannel-logout', {
      data: {},
    });
    expect(response.status()).toBe(400);
  });

  // Отправляем токен с пустым payload и фейковой подписью.
  // Ожидаем 401 — jwtVerify не может проверить подпись.
  test('with token missing sub should return 401', async ({ page }) => {
    const invalidToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ9.signature';

    const response = await page.request.post('/api/auth/backchannel-logout', {
      data: {
        logout_token: invalidToken,
      },
    });
    expect(response.status()).toBe(401);
  });

  // Отправляем токен с payload, но неверной подписью.
  // Ожидаем 401 — подпись не сходится с JWKS Keycloak.
  test('with invalid signature should return 401', async ({ page }) => {
    const invalidToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiS1MjM0NTY3ODkifQ.invalid_signature';

    const response = await page.request.post('/api/auth/backchannel-logout', {
      data: {
        logout_token: invalidToken,
      },
    });
    expect(response.status()).toBe(401);
  });
});
