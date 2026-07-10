import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { config } from '../config/config';
import { Logger } from '../shared/logger';

const USER_SESSIONS_PREFIX = 'user_sessions';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public readonly client: RedisClientType;

  constructor() {
    this.client = createClient({
      url: config.redis.url,
      password: config.redis.password,
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

  async addUserSession(userId: string, sessionId: string): Promise<void> {
    await this.client.sAdd(`${USER_SESSIONS_PREFIX}:${userId}`, sessionId);
    await this.client.expire(`${USER_SESSIONS_PREFIX}:${userId}`, config.session.ttl);
  }

  async removeUserSession(userId: string, sessionId: string): Promise<void> {
    await this.client.sRem(`${USER_SESSIONS_PREFIX}:${userId}`, sessionId);
  }

  async getUserSessions(userId: string): Promise<string[]> {
    return this.client.sMembers(`${USER_SESSIONS_PREFIX}:${userId}`);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.getUserSessions(userId);
    for (const sid of sessionIds) {
      await this.client.del(`${config.session.prefix}${sid}`);
    }
    await this.client.del(`${USER_SESSIONS_PREFIX}:${userId}`);
  }

  async refreshUserSessionTtl(userId: string): Promise<void> {
    await this.client.expire(`${USER_SESSIONS_PREFIX}:${userId}`, config.session.ttl);
  }

  async refreshSessionStoreTtl(sessionId: string): Promise<void> {
    await this.client.expire(`${config.session.prefix}${sessionId}`, config.session.ttl);
  }
}
