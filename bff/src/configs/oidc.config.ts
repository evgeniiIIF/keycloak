import * as dotenv from 'dotenv';

dotenv.config();

export const oidcConfig = {
  issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/TestRealm',
  hostname: process.env.KEYCLOAK_HOSTNAME || 'keycloak',
  port: parseInt(process.env.KEYCLOAK_PORT || '8080', 10),
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'bff-client',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'secret',
  redirectUri: process.env.KEYCLOAK_REDIRECT_URI || 'http://localhost:3000/callback',
  scope: 'openid profile email',
  jwksUri: process.env.KEYCLOAK_JWKS_URI || 'http://localhost:8080/realms/TestRealm/protocol/openid-connect/certs',
};