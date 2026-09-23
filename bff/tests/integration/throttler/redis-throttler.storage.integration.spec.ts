import { Test, TestingModule } from '@nestjs/testing';

import { AppConfigService } from '@/config/app-config.service';
import { RedisClient } from '@/infra/redis/redis.client';
import { RedisThrottlerStorage } from '@/infra/throttler/redis-throttler.storage';
import { AppLogger } from '@/shared/logger/app-logger.service';

describe('RedisThrottlerStorage (integration, real Redis)', () => {
  let storage: RedisThrottlerStorage;
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
      providers: [AppConfigService, { provide: AppLogger, useValue: loggerMock }, RedisClient, RedisThrottlerStorage],
    }).compile();

    redis = moduleRef.get(RedisClient);
    storage = moduleRef.get(RedisThrottlerStorage);

    await redis.onModuleInit();
  });

  afterAll(async () => {
    await redis.onModuleDestroy();
  });

  beforeEach(async () => {
    await redis.flushAll();
  });

  it('11 запросов при limit=10 и blockDuration>0 → 11-й блокируется', async () => {
    const BLOCK = 60_000;

    for (let i = 1; i <= 10; i++) {
      const result = await storage.increment('user-1', 60_000, 10, BLOCK, 'default');
      expect(result.totalHits).toBe(i);
      expect(result.isBlocked).toBe(false);
    }

    const blocked = await storage.increment('user-1', 60_000, 10, BLOCK, 'default');
    expect(blocked.totalHits).toBe(11);
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.timeToBlockExpire).toBeGreaterThan(0);
  });

  it('при blockDuration=0 запросы считаются, но не блокируются', async () => {
    for (let i = 1; i <= 12; i++) {
      const result = await storage.increment('user-noblock', 60_000, 10, 0, 'default');
      expect(result.totalHits).toBe(i);
      expect(result.isBlocked).toBe(false);
    }
  });

  it('разные ключи не мешают друг другу', async () => {
    await storage.increment('user-1', 60_000, 10, 0, 'default');
    await storage.increment('user-1', 60_000, 10, 0, 'default');

    const other = await storage.increment('user-2', 60_000, 10, 0, 'default');
    expect(other.totalHits).toBe(1);
  });

  it('разные throttlerName не мешают друг другу', async () => {
    await storage.increment('user-1', 60_000, 10, 0, 'default');
    await storage.increment('user-1', 60_000, 10, 0, 'default');

    const strict = await storage.increment('user-1', 60_000, 10, 0, 'strict');
    expect(strict.totalHits).toBe(1);
  });

  it('TTL счётчика истекает и счётчик сбрасывается', async () => {
    await storage.increment('user-ttl', 1, 10, 0, 'default');   // ttl=1 сек

    await new Promise((r) => setTimeout(r, 1500));

    const fresh = await storage.increment('user-ttl', 1, 10, 0, 'default');
    expect(fresh.totalHits).toBe(1);
  });

  it('блокировка держится blockDuration секунд', async () => {
    for (let i = 1; i <= 11; i++) {
      await storage.increment('user-block', 60_000, 10, 2, 'default');
    }

    // Пока блокировка активна — isBlocked=true, hits растёт
    const stillBlocked = await storage.increment('user-block', 60_000, 10, 2, 'default');
    expect(stillBlocked.isBlocked).toBe(true);
    expect(stillBlocked.timeToBlockExpire).toBeGreaterThan(0);
  });
});
