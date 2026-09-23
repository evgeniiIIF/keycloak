import { Test, TestingModule } from '@nestjs/testing';

import { RedisClient } from '@/infra/redis/redis.client';
import { RedisThrottlerStorage } from '@/infra/throttler/redis-throttler.storage';

// ttl и blockDuration в тестах — в секундах; storage конвертирует их в секунды
// для Redis (Math.ceil(ms/1000)). Проверяем контракт с Lua-скриптом.
describe('RedisThrottlerStorage (unit)', () => {
  let storage: RedisThrottlerStorage;
  let redis: { eval: jest.Mock };

  beforeEach(async () => {
    redis = { eval: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RedisThrottlerStorage,
        { provide: RedisClient, useValue: redis },
      ],
    }).compile();

    storage = moduleRef.get(RedisThrottlerStorage);
  });

  describe('increment', () => {
    it('строит hit/block ключи с throttlerName и key', async () => {
      redis.eval.mockResolvedValue([1, 60, 0, 0]);

      await storage.increment('user-1', 60_000, 10, 0, 'default');

      const [script, keys] = redis.eval.mock.calls[0];
      expect(script).toContain('INCR');                                 // Lua-скрипт передан
      expect(keys).toEqual([
        'throttle:default:hits:user-1',
        'throttle:default:block:user-1',
      ]);
    });

    it('передаёт в Lua ttl/limit/blockDuration в секундах', async () => {
      redis.eval.mockResolvedValue([1, 60, 0, 0]);

      await storage.increment('k', 60_000, 100, 30_000, 'default');

      const [, , args] = redis.eval.mock.calls[0];
      expect(args).toEqual(['60', '100', '30']);
    });

    it('округляет ttl вверх при конвертации мс → сек', async () => {
      redis.eval.mockResolvedValue([1, 1, 0, 0]);

      await storage.increment('k', 1500, 10, 0, 'default');

      const [, , args] = redis.eval.mock.calls[0];
      expect(args[0]).toBe('2');   // 1500 мс → 2 сек
    });

    it('мапит результат Lua в ThrottlerStorageRecord', async () => {
      redis.eval.mockResolvedValue([5, 42, 0, 0]);

      const result = await storage.increment('k', 60_000, 10, 0, 'default');

      expect(result).toEqual({
        totalHits: 5,
        timeToExpire: 42,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('isBlocked=1 в Lua → isBlocked=true в результате', async () => {
      redis.eval.mockResolvedValue([11, 42, 1, 60]);

      const result = await storage.increment('k', 60_000, 10, 60_000, 'default');

      expect(result.isBlocked).toBe(true);
      expect(result.timeToBlockExpire).toBe(60);
    });

    it('isBlocked=0 в Lua → isBlocked=false в результате', async () => {
      redis.eval.mockResolvedValue([1, 60, 0, 0]);

      const result = await storage.increment('k', 60_000, 10, 0, 'default');

      expect(result.isBlocked).toBe(false);
    });

    it('разные throttlerName → разные ключи', async () => {
      redis.eval.mockResolvedValue([1, 60, 0, 0]);

      await storage.increment('k', 60_000, 10, 0, 'default');
      await storage.increment('k', 60_000, 10, 0, 'strict');

      const [, keys1] = redis.eval.mock.calls[0];
      const [, keys2] = redis.eval.mock.calls[1];
      expect(keys1[0]).toBe('throttle:default:hits:k');
      expect(keys2[0]).toBe('throttle:strict:hits:k');
    });
  });
});
