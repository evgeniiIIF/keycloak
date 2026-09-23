import { KeycloakJwtPayload, TokenSet } from '@/modules/auth/types/keycloak';

import { signTestJwt } from './jwt-keys';

const TEST_SUB = '6a1e0d1a-2461-403f-bd11-d79c7efb3ebd';

async function createTestIdToken(): Promise<string> {
  return signTestJwt(
    {
      email: 'test@example.com',
      preferred_username: 'testuser',
      name: 'Test User',
      realm_access: { roles: ['user'] },
      resource_access: {},
      nonce: 'test-nonce',
    },
    { subject: TEST_SUB },
  );
}

export const validTokenSet: TokenSet = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  id_token: '',
};

export const refreshedTokenSet: TokenSet = {
  access_token: 'new-access-token',
  refresh_token: 'new-refresh-token',
  id_token: 'new-id-token',
};

export const idTokenPayload: KeycloakJwtPayload = {
  sub: TEST_SUB,
  email: 'test@example.com',
  preferred_username: 'testuser',
  name: 'Test User',
  realm_access: { roles: ['user'] },
  resource_access: {},
};

export async function initFixtures(): Promise<void> {
  validTokenSet.id_token = await createTestIdToken();
}
