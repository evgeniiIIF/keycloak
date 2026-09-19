import { SignJWT } from 'jose';

import { KeycloakJwtPayload, TokenSet } from '@/modules/auth/types/keycloak';

import { TEST_JWT_AUDIENCE, TEST_JWT_ISSUER, TEST_JWT_KEY } from './jwt-keys';

async function createTestIdToken(): Promise<string> {
  return new SignJWT({
    email: 'test@example.com',
    preferred_username: 'testuser',
    name: 'Test User',
    realm_access: { roles: ['user'] },
    resource_access: {},
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('6a1e0d1a-2461-403f-bd11-d79c7efb3ebd')
    .setIssuer(TEST_JWT_ISSUER)
    .setAudience(TEST_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(TEST_JWT_KEY);
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
  sub: '6a1e0d1a-2461-403f-bd11-d79c7efb3ebd',
  email: 'test@example.com',
  preferred_username: 'testuser',
  name: 'Test User',
  realm_access: { roles: ['user'] },
  resource_access: {},
};

export async function initFixtures(): Promise<void> {
  validTokenSet.id_token = await createTestIdToken();
}
