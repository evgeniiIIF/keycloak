import { Injectable } from '@nestjs/common';

import { config } from '@/config/config';
import { RedisClient } from '@/infra/redis/redis.client';
import { RedisKeys } from '@/infra/redis/redis.keys';

// Данные OAuth flow, которые надо пережить между редиректом на Keycloak
// и callback-ом: PKCE verifier и OIDC nonce.
export interface OAuthState {
  codeVerifier: string;
  nonce: string;
}

// Хранилище OAuth state → { codeVerifier, nonce }.
// Живёт вне сессии: используется между редиректом на Keycloak и callback-ом.
@Injectable()
export class OAuthStateRepository {
  constructor(private readonly redis: RedisClient) {}

  // Сохраняем PKCE verifier и nonce по state на время OAuth flow
  async save(state: string, value: OAuthState): Promise<void> {
    const key = RedisKeys.oauthState(state);
    await this.redis.set(key, JSON.stringify(value), config.session.oauthStateTtl);
  }

  // Достаём данные по state или null, если state истёк/невалиден
  async find(state: string): Promise<OAuthState | null> {
    const key = RedisKeys.oauthState(state);
    const raw = await this.redis.get(key);
    return this.parse(raw);
  }

  // Удаляем state после успешного обмена кода на токены
  async delete(state: string): Promise<void> {
    const key = RedisKeys.oauthState(state);
    await this.redis.del(key);
  }

  // ── Примитивы ──────────────────────────────────────────────────

  // Парсим JSON из Redis в OAuthState или null
  private parse(raw: string | null): OAuthState | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OAuthState;
    } catch {
      return null;
    }
  }
}
