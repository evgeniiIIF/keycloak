import { getTokenViaPasswordGrant } from '@tests/shared/utils/keycloak-token';

import { AppConfigService } from '@/config/app-config.service';
import { KeycloakClient } from '@/modules/auth/services/keycloak.service';

describe('KeycloakClient (integration, real Keycloak)', () => {
  let keycloakClient: KeycloakClient;

  beforeAll(() => {
    const config = new AppConfigService();
    keycloakClient = new KeycloakClient(config);
  });

  it('successfully refreshes access token using refresh token', async () => {
    const tokens = await getTokenViaPasswordGrant('testuser', '123');

    const newTokens = await keycloakClient.refreshTokens(tokens.refresh_token);

    expect(newTokens.access_token).toBeTruthy();
    expect(newTokens.refresh_token).toBeTruthy();
    expect(newTokens.access_token).not.toBe(tokens.access_token);
  });

  it('fails to refresh after refresh token is revoked', async () => {
    const tokens = await getTokenViaPasswordGrant('testuser', '123');

    await keycloakClient.revokeRefreshToken(tokens.refresh_token);

    await expect(keycloakClient.refreshTokens(tokens.refresh_token)).rejects.toThrow();
  });
});
