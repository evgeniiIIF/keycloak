import { getTokenViaPasswordGrant } from "@test/shared/utils/keycloak-token";

import { KeycloakClient } from "@/auth/services/keycloak.service";


describe('KeycloakClient with real Keycloak / KeycloakClient с реальным Keycloak', () => {
  let keycloakClient: KeycloakClient;

  beforeAll(() => {
    // Создаём реальный экземпляр KeycloakClient для работы с тестовым контейнером
    keycloakClient = new KeycloakClient();
  });

  it('successfully refreshes access token using refresh token / успешно обновляет access token по refresh token', async () => {
    // Получаем реальные токены через password grant
    const tokens = await getTokenViaPasswordGrant('testuser', '123');

    // Обновляем токены с помощью refresh token
    const newTokens = await keycloakClient.refreshTokens(tokens.refresh_token);

    // Убеждаемся, что новые токены получены и отличаются от старых
    expect(newTokens.access_token).toBeTruthy();
    expect(newTokens.refresh_token).toBeTruthy();
    expect(newTokens.access_token).not.toBe(tokens.access_token);
  });

  it('fails to refresh after refresh token is revoked / не может обновить после отзыва refresh token', async () => {
    // Получаем токены
    const tokens = await getTokenViaPasswordGrant('testuser', '123');

    // Отзываем refresh token
    await keycloakClient.revokeRefreshToken(tokens.refresh_token);

    // Попытка обновления с отозванным refresh token должна завершиться ошибкой
    await expect(keycloakClient.refreshTokens(tokens.refresh_token)).rejects.toThrow();
  });
});
