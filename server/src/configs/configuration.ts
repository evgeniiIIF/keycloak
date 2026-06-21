import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  keycloak: {
    realm: process.env.KEYCLOAK_REALM || 'master',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'backend-client',
    secret: process.env.KEYCLOAK_CLIENT_SECRET || 'secret-key',
  },
};
