import { createSecretKey, KeyObject } from 'crypto';

// Единый HS256-секрет для всех тестов, которые подписывают/верифицируют JWT.
// В проде используется RS256 + JWKS Keycloak, здесь — симметричный ключ,
// чтобы тесты не зависели от инфраструктуры.
const SECRET_BYTES = new TextEncoder().encode('test-secret-key-for-jwt-signing');

export const TEST_JWT_KEY: KeyObject = createSecretKey(SECRET_BYTES);

export const TEST_JWT_ISSUER = 'http://localhost:8080/realms/TestRealm';
export const TEST_JWT_AUDIENCE = 'bff-client';
