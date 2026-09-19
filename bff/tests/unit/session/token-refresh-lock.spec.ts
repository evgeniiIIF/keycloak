import { Test, TestingModule } from '@nestjs/testing';

import { RedisClient } from '@/infra/redis/redis.client';
import { TokenRefreshLock } from '@/modules/sessions/services/token-refresh-lock.service';

describe('TokenRefreshLock (unit)', () => {
  let lock: TokenRefreshLock;
  let redis: { setNx: jest.Mock; exists: jest.Mock; eval: jest.Mock };

  beforeEach(async () => {
    redis = { setNx: jest.fn(), exists: jest.fn(), eval: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [TokenRefreshLock, { provide: RedisClient, useValue: redis }],
    }).compile();

    lock = moduleRef.get(TokenRefreshLock);
  });

  describe('acquire', () => {
    it('возвращает acquired=true и owner, если Redis.setNx вернул true', async () => {
      redis.setNx.mockResolvedValue(true);

      const result = await lock.acquire('session-1');

      expect(result.acquired).toBe(true);
      expect(result.owner).toBeDefined();
      expect(redis.setNx).toHaveBeenCalledWith(
        'refresh_lock:session-1',
        expect.any(String),
        expect.any(Number),
      );
    });

    it('возвращает acquired=false, если Redis.setNx вернул false', async () => {
      redis.setNx.mockResolvedValue(false);

      const result = await lock.acquire('session-1');

      expect(result.acquired).toBe(false);
    });
  });

  describe('release', () => {
    it('вызывает Redis.eval с ключом и owner', async () => {
      redis.eval.mockResolvedValue(1);

      await lock.release('session-1', 'owner-123');

      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        ['refresh_lock:session-1'],
        ['owner-123'],
      );
    });
  });

  describe('waitAndRetry', () => {
    it('возвращается сразу, если блокировка уже освобождена', async () => {
      redis.exists.mockResolvedValue(false);

      await expect(lock.waitAndRetry('session-1', 100)).resolves.toBeUndefined();
    });
  });
});
