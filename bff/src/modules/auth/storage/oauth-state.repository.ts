import { Injectable } from '@nestjs/common';

import { config } from '@/config/config';
import { RedisClient } from '@/infra/redis/redis.client';
import { RedisKeys } from '@/infra/redis/redis.keys';

// Хранилище OAuth state → code_verifier (PKCE).
// Живёт вне сессии: используется между редиректом на Keycloak и callback-ом.
@Injectable()
export class OAuthStateRepository {
  constructor(private readonly redis: RedisClient) {}

  // Сохраняем code_verifier по state на время OAuth flow
  async save(state: string, codeVerifier: string): Promise<void> {
    const key = RedisKeys.oauthState(state);
    await this.redis.set(key, codeVerifier, config.session.oauthStateTtl);
  }

  // Достаём code_verifier по state или null, если state истёк/невалиден
  async find(state: string): Promise<string | null> {
    const key = RedisKeys.oauthState(state);
    return this.redis.get(key);
  }

  // Удаляем state после успешного обмена кода на токены
  async delete(state: string): Promise<void> {
    const key = RedisKeys.oauthState(state);
    await this.redis.del(key);
  }
}
