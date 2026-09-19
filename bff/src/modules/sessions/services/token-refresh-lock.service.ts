import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { RedisClient } from '@/infra/redis/redis.client';
import { RedisKeys, RedisTtl } from '@/infra/redis/redis.keys';

// Снимаем блокировку только если мы её владельцы (иначе можно снести чужой lock)
const RELEASE_LUA = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

// Distributed lock на обновление токенов одной сессии.
// Гарантирует, что при параллельных 401 только один поток пойдёт в Keycloak,
// остальные дождутся и переиспользуют результат.
@Injectable()
export class TokenRefreshLock {
  constructor(private readonly redis: RedisClient) {}

  // Пытаемся взять блокировку.
  // acquired=false означает, что блокировку уже держит кто-то другой — надо ждать.
  async acquire(sessionId: string): Promise<RefreshLock> {
    const owner = randomUUID();                                    // уникальный ID владельца
    const key = RedisKeys.refreshLock(sessionId);                  // ключ блокировки
    const acquired = await this.redis.setNx(key, owner, RedisTtl.refreshLockSeconds);
    return { acquired, owner };
  }

  // Ждём, пока другой поток освободит блокировку.
  // Экспоненциальный backoff от 50 мс до 1 с, общий таймаут — maxWaitMs.
  async waitAndRetry(sessionId: string, maxWaitMs = 30_000): Promise<void> {
    const deadline = Date.now() + maxWaitMs;                       // дедлайн ожидания
    let intervalMs = 50;                                           // стартовый интервал

    while (Date.now() < deadline) {                                // пока не вышли по времени
      if (!(await this.isLocked(sessionId))) return;               // блокировки нет — выходим
      await this.sleep(intervalMs);                                // ждём перед следующей проверкой
      intervalMs = Math.min(intervalMs * 1.5, 1000);               // растим интервал, но не выше 1 с
    }
    throw new Error('Timeout waiting for token refresh lock');     // не дождались — кидаем
  }

  // Освобождаем блокировку, только если мы всё ещё её владельцы
  async release(sessionId: string, owner: string): Promise<void> {
    const key = RedisKeys.refreshLock(sessionId);                  // ключ блокировки
    await this.redis.eval(RELEASE_LUA, [key], [owner]);            // атомарно снимаем, если наш owner
  }

  // ── Примитивы ──────────────────────────────────────────────────

  // Проверяем, держит ли кто-то блокировку прямо сейчас
  private async isLocked(sessionId: string): Promise<boolean> {
    return this.redis.exists(RedisKeys.refreshLock(sessionId));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Результат попытки взять блокировку
export interface RefreshLock {
  acquired: boolean;
  owner: string;
}
