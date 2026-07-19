import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { config } from '../../config/config';
import { RedisKeys } from '../constants/redis-key-prefixes';
import { Logger } from '../../shared/logger/logger';

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
    await this.client.connect();
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
    for (const sid of sessionIds) {
      await this.client.del(`${config.session.prefix}${sid}`);
    }
    await this.client.del(RedisKeys.userSessions(userId));
  }

  async refreshUserSessionTtl(userId: string): Promise<void> {
    await this.client.expire(RedisKeys.userSessions(userId), config.session.ttl);
  }

  async refreshSessionStoreTtl(sessionId: string): Promise<void> {
    await this.client.expire(`${config.session.prefix}${sessionId}`, config.session.ttl);
  }
}
