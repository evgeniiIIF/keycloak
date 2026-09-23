import { generateKeyPairSync, KeyObject } from 'crypto';
import { SignJWT } from 'jose';

// RSA-пара для тестов: подпись RS256, верификация через публичный ключ.
// В проде используется Keycloak JWKS (RS256), поэтому тесты максимально
// приближены к реальности — HS256 в тестах не используется.
//
// Без publicKeyEncoding/privateKeyEncoding Node возвращает KeyObject,
// который jose принимает напрямую (KeyLike).
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

export const TEST_JWT_PRIVATE_KEY: KeyObject = privateKey;
export const TEST_JWT_PUBLIC_KEY: KeyObject = publicKey;
export const TEST_JWT_ISSUER = 'http://localhost:8080/realms/TestRealm';
export const TEST_JWT_AUDIENCE = 'bff-client';

export interface TestJwtOptions {
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  subject?: string;
}

// Подписать тестовый JWT (RS256) с issuer/audience по умолчанию.
export async function signTestJwt(
  payload: Record<string, unknown>,
  options: TestJwtOptions = {},
): Promise<string> {
  const {
    issuer = TEST_JWT_ISSUER,
    audience = TEST_JWT_AUDIENCE,
    expiresIn = '1h',
    subject,
  } = options;

  const builder = new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn);

  if (subject) builder.setSubject(subject);

  return builder.sign(TEST_JWT_PRIVATE_KEY);
}
