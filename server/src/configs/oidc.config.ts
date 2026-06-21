import * as dotenv from 'dotenv';

dotenv.config();

export const oidcConfig = {
  issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/TestRealm',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'backend-client',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'secret',
  redirectUri: process.env.KEYCLOAK_REDIRECT_URI || 'http://localhost:3000/callback',
  scope: 'openid profile email',
};