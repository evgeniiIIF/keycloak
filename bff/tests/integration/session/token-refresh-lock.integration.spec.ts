import { Test, TestingModule } from '@nestjs/testing';

import { AppConfigService } from '@/config/app-config.service';
import { RedisClient } from '@/infra/redis/redis.client';
import { TokenRefreshLock } from '@/modules/sessions/services/token-refresh-lock.service';
import { AppLogger } from '@/shared/logger/app-logger.service';

describe('TokenRefreshLock (integration, real Redis)', () => {
  let lock: TokenRefreshLock;
  let redis: RedisClient;

  beforeAll(async () => {
    const loggerMock = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as AppLogger;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [AppConfigService, { provide: AppLogger, useValue: loggerMock }, RedisClient, TokenRefreshLock],
    }).compile();

    redis = moduleRef.get(RedisClient);
    lock = moduleRef.get(TokenRefreshLock);

    await redis.onModuleInit();
  });

  afterAll(async () => {
    await redis.onModuleDestroy();
  });

  beforeEach(async () => {
    await redis.flushAll();
  });

  describe('Race conditions', () => {
    it('из трёх параллельных acquire побеждает ровно один', async () => {
      const results = await Promise.all([
        lock.acquire('session-1'),
        lock.acquire('session-1'),
        lock.acquire('session-1'),
      ]);

      expect(results.filter(r => r.acquired).length).toBe(1);
      expect(results.filter(r => !r.acquired).length).toBe(2);

      const winner = results.find(r => r.acquired)!;
      await lock.release('session-1', winner.owner);
    });

    it('разные сессии не блокируют друг друга', async () => {
      const sessions = ['user-A', 'user-B', 'user-C'];
      const all = sessions.flatMap(s => [lock.acquire(s), lock.acquire(s), lock.acquire(s)]);
      const results = await Promise.all(all);

      for (let i = 0; i < sessions.length; i++) {
        const winners = results.slice(i * 3, i * 3 + 3).filter(r => r.acquired);
        expect(winners.length).toBe(1);
        await lock.release(sessions[i], winners[0].owner);
      }
    });
  });

  describe('Ownership', () => {
    it('чужой owner не может освободить блокировку', async () => {
      const owner = await lock.acquire('session-1');

      await lock.release('session-1', 'wrong-owner');

      const second = await lock.acquire('session-1');
      expect(second.acquired).toBe(false);

      await lock.release('session-1', owner.owner);
    });

    it('после release владельцем блокировку можно взять заново', async () => {
      const winner = await lock.acquire('session-1');
      await lock.release('session-1', winner.owner);

      const retry = await lock.acquire('session-1');
      expect(retry.acquired).toBe(true);

      await lock.release('session-1', retry.owner);
    });
  });

  describe('waitAndRetry', () => {
    it('проигравший дожидается release и продолжает', async () => {
      const winner = await lock.acquire('session-1');

      const waitPromise = lock.waitAndRetry('session-1', 5000);
      setTimeout(() => { void lock.release('session-1', winner.owner); }, 100);

      await expect(waitPromise).resolves.toBeUndefined();
    });

    it('бросает ошибку таймаута, если lock не освобождён', async () => {
      await lock.acquire('session-1');

      await expect(lock.waitAndRetry('session-1', 1000))
        .rejects.toThrow('Timeout waiting for token refresh lock');
    });
  });

  describe('TTL', () => {
    it('блокировка автоматически истекает', async () => {
      await lock.acquire('session-ttl');
      await redis.expire('refresh_lock:session-ttl', 1);

      await new Promise(resolve => setTimeout(resolve, 1500));

      const second = await lock.acquire('session-ttl');
      expect(second.acquired).toBe(true);

      await lock.release('session-ttl', second.owner);
    });
  });
});
