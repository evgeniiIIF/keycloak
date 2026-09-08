import { SignJWT } from 'jose';
import { TokenSet, KeycloakJwtPayload } from '../../src/types/keycloak';

const secret = new TextEncoder().encode('test-secret-key-for-jwt-signing');

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
    .setIssuer('http://localhost:8080/realms/TestRealm')
    .setAudience('bff-client')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
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

export const idPayload: KeycloakJwtPayload = {
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
