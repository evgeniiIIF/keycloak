import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../services/redis.service';

const LOCK_PREFIX = 'refresh_lock:';
const LOCK_TTL_SECONDS = 10;

const RELEASE_LUA = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

@Injectable()
export class TokenRefreshLock {
  private readonly owner = randomUUID();

  constructor(private redis: RedisService) {}

  async acquire(sessionId: string): Promise<boolean> {
    const key = `${LOCK_PREFIX}${sessionId}`;
    const result = await this.redis.client.set(key, this.owner, { NX: true, EX: LOCK_TTL_SECONDS });
    return result === 'OK';
  }

  async waitAndRetry(sessionId: string, maxWaitMs = 5000, intervalMs = 50): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const key = `${LOCK_PREFIX}${sessionId}`;
      const exists = await this.redis.client.exists(key);
      if (!exists) return;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  async release(sessionId: string): Promise<void> {
    const key = `${LOCK_PREFIX}${sessionId}`;
    await this.redis.client.eval(RELEASE_LUA, { keys: [key], arguments: [this.owner] });
  }
}
