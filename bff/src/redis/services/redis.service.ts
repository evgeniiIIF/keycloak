import { Injectable, OnModuleDestroy,OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

import { config } from '../../config/config';
import { Logger } from '../../shared/logger/logger';
import { RedisKeys } from '../constants/redis-key-prefixes';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public readonly client: RedisClientType;

  constructor() {
    const useTls = config.redis.url.startsWith('rediss://');

    this.client = createClient({
      url: config.redis.url,
      password: config.redis.password,
      socket: useTls ? { tls: true } : undefined,
    });

    this.client.on('error', (err) => Logger.error('Redis', err.message));
    this.client.on('connect', () => Logger.info('Redis', 'Connected'));
  }

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      Logger.error('Redis', `Failed to connect to Redis: ${errorMessage}`);
      // Не бросаем ошибку, чтобы приложение могло запуститься (хотя будет работать в degraded mode)
    }
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  // ── OAuth state (pre-auth, no session) ──────────────────────────

  async setOAuthState(state: string, codeVerifier: string): Promise<void> {
    const key = RedisKeys.oauthState(state);
    await this.client.set(key, codeVerifier, { EX: config.session.oauthStateTtl });
  }

  async getOAuthState(state: string): Promise<string | null> {
    const key = RedisKeys.oauthState(state);
    return this.client.get(key);
  }

  async deleteOAuthState(state: string): Promise<void> {
    const key = RedisKeys.oauthState(state);
    await this.client.del(key);
  }

  // ── User sessions ──────────────────────────────────────────────

  async addUserSession(userId: string, sessionId: string): Promise<void> {
    const key = RedisKeys.userSessions(userId);
    const pipeline = this.client.multi();
    pipeline.sAdd(key, sessionId);
    pipeline.expire(key, config.session.ttl);
    await pipeline.exec();
  }

  async removeUserSession(userId: string, sessionId: string): Promise<void> {
    await this.client.sRem(RedisKeys.userSessions(userId), sessionId);
  }

  async getUserSessions(userId: string): Promise<string[]> {
    return this.client.sMembers(RedisKeys.userSessions(userId));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.getUserSessions(userId);
    if (sessionIds.length > 0) {
      const keys = sessionIds.map(sid => `${config.session.prefix}${sid}`);
      await this.client.del(keys); // удаляем все ключи сессий одним запросом
    }
    await this.client.del(RedisKeys.userSessions(userId)); // удаляем список сессий пользователя
  }

  async refreshUserSessionTtl(userId: string): Promise<void> {
    await this.client.expire(RedisKeys.userSessions(userId), config.session.ttl);
  }

  async refreshSessionStoreTtl(sessionId: string): Promise<void> {
    await this.client.expire(`${config.session.prefix}${sessionId}`, config.session.ttl);
  }
}
