process.env.SESSION_SECRET = 'test-secret-key-that-is-at-least-32-characters-long-for-testing';
process.env.NODE_ENV = 'test';
process.env.KEYCLOAK_ISSUER = 'http://localhost:8080/realms/TestRealm';
process.env.KEYCLOAK_CLIENT_ID = 'bff-client';
process.env.KEYCLOAK_CLIENT_SECRET = 'test-secret';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.KC_HOSTNAME = 'keycloak';
