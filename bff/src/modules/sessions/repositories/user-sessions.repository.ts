import { Injectable } from '@nestjs/common';

import { config } from '@/config/config';
import { RedisClient } from '@/infra/redis/redis.client';
import { RedisKeys } from '@/infra/redis/redis.keys';

// Индекс userId → [sessionId].
// Нужен, чтобы уметь находить и удалять все сессии пользователя (backchannel logout,
// «выйти со всех устройств», принудительный logout админом).
@Injectable()
export class UserSessionsRepository {
  constructor(private readonly redis: RedisClient) {}

  // Добавляем сессию в список пользователя и продлеваем TTL индекса
  async add(userId: string, sessionId: string): Promise<void> {
    const key = RedisKeys.userSessions(userId);
    await this.redis.pipeline([
      { type: 'sAdd', key, member: sessionId },
      { type: 'expire', key, ttlSeconds: config.session.ttl },
    ]);
  }

  // Удаляем одну сессию из списка пользователя
  async remove(userId: string, sessionId: string): Promise<void> {
    const key = RedisKeys.userSessions(userId);
    await this.redis.sRem(key, sessionId);
  }

  // Возвращаем все sessionId пользователя
  async findAll(userId: string): Promise<string[]> {
    const key = RedisKeys.userSessions(userId);
    return this.redis.sMembers(key);
  }

  // Продлеваем TTL индекса пользователя
  async touch(userId: string): Promise<void> {
    const key = RedisKeys.userSessions(userId);
    await this.redis.expire(key, config.session.ttl);
  }

  // Удаляем индекс пользователя целиком
  async deleteIndex(userId: string): Promise<void> {
    const key = RedisKeys.userSessions(userId);
    await this.redis.del(key);
  }
}
