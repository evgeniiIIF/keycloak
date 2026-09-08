import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { RedisService } from '../../redis/services/redis.service';

const LOCK_PREFIX = 'refresh_lock:';
const LOCK_TTL_SECONDS = 30;

const RELEASE_LUA = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

@Injectable()
export class TokenRefreshLock {
  constructor(private redis: RedisService) {}

  async acquire(sessionId: string): Promise<{ acquired: boolean; owner: string }> {
    const owner = randomUUID(); // генерируем уникальный ID владельца для каждой попытки
    const key = `${LOCK_PREFIX}${sessionId}`;
    const result = await this.redis.client.set(key, owner, { NX: true, EX: LOCK_TTL_SECONDS });
    return { acquired: result === 'OK', owner };
  }

  // Ждем разблокировки с экспоненциальным увеличением интервала (до 1с)
  async waitAndRetry(sessionId: string, maxWaitMs = 30000): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    let intervalMs = 50;

    while (Date.now() < deadline) {
      const key = `${LOCK_PREFIX}${sessionId}`;
      const exists = await this.redis.client.exists(key);
      if (!exists) return;
      await new Promise((r) => setTimeout(r, intervalMs));
      intervalMs = Math.min(intervalMs * 1.5, 1000);
    }
    throw new Error('Timeout waiting for token refresh lock');
  }

  async release(sessionId: string, owner: string): Promise<void> {
    const key = `${LOCK_PREFIX}${sessionId}`;
    await this.redis.client.eval(RELEASE_LUA, { keys: [key], arguments: [owner] });
  }
}
