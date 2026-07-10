import { KeycloakClient } from './keycloak-client';

describe('KeycloakClient', () => {
  let client: KeycloakClient;

  beforeEach(() => {
    client = new KeycloakClient();
  });

  it('should be instantiable', () => {
    expect(client).toBeDefined();
  });
});
