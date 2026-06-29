import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8082',
  protectedServiceUrl: process.env.PROTECTED_SERVICE_URL || 'http://protected-service:8080',
  session: {
    prefix: process.env.SESSION_PREFIX || 'sess:',
    ttl: parseInt(process.env.SESSION_TTL || '86400', 10),
  },
  auth: {
    stateTtl: parseInt(process.env.AUTH_STATE_TTL || '300', 10),
  },
  keycloak: {
    realm: process.env.KEYCLOAK_REALM || 'master',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'bff-client',
    secret: process.env.KEYCLOAK_CLIENT_SECRET || 'secret-key',
  },
};
