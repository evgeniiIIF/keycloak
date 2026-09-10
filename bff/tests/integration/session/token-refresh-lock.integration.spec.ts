import { Test, TestingModule } from '@nestjs/testing';

import { RedisService } from '@/infra/redis/services/redis.service';
import { TokenRefreshLock } from '@/modules/auth/sessions/services/token-refresh-lock.service';

describe('TokenRefreshLock — блокировка при обновлении токена (integration)', () => {
  let tokenRefreshLock: TokenRefreshLock;
  let redisService: RedisService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [RedisService, TokenRefreshLock],
    }).compile();

    redisService = moduleRef.get(RedisService);
    tokenRefreshLock = moduleRef.get(TokenRefreshLock);

    await redisService.onModuleInit();
  });

  afterAll(async () => {
    await redisService.onModuleDestroy();
  });

  beforeEach(async () => {
    await redisService.client.flushAll();
  });

  describe('Сценарий 1: Один пользователь делает три параллельных запроса', () => {
    it('из трёх параллельных запросов побеждает ровно один, остальные два проигрывают', async () => {
      const results = await Promise.all([
        tokenRefreshLock.acquire('session-1'),
        tokenRefreshLock.acquire('session-1'),
        tokenRefreshLock.acquire('session-1'),
      ]);

      const winners = results.filter(r => r.acquired);
      const losers = results.filter(r => !r.acquired);

      expect(winners.length).toBe(1);
      expect(losers.length).toBe(2);

      await tokenRefreshLock.release('session-1', winners[0].owner);
    });
  });

  describe('Сценарий 2: Три разных пользователя, каждый делает по три параллельных запроса', () => {
    it('каждый из трёх пользователей получает ровно одну блокировку из трёх своих запросов', async () => {
      const sessions = ['user-A', 'user-B', 'user-C'];

      const allRequests = sessions.flatMap(sessionId => [
        tokenRefreshLock.acquire(sessionId),
        tokenRefreshLock.acquire(sessionId),
        tokenRefreshLock.acquire(sessionId),
      ]);

      const results = await Promise.all(allRequests);

      for (let i = 0; i < sessions.length; i++) {
        const userResults = results.slice(i * 3, i * 3 + 3);
        const winners = userResults.filter(r => r.acquired);
        
        expect(winners.length).toBe(1);

        await tokenRefreshLock.release(sessions[i], winners[0].owner);
      }
    });
  });

  describe('Сценарий 3: Проигравший запрос повторяет попытку после освобождения', () => {
    it('проигравший запрос получает блокировку после того, как победитель освободил её', async () => {
      const [winner, loser] = await Promise.all([
        tokenRefreshLock.acquire('session-1'),
        tokenRefreshLock.acquire('session-1'),
      ]);

      expect(winner.acquired).toBe(true);
      expect(loser.acquired).toBe(false);

      await tokenRefreshLock.release('session-1', winner.owner);

      const retryResult = await tokenRefreshLock.acquire('session-1');
      expect(retryResult.acquired).toBe(true);

      await tokenRefreshLock.release('session-1', retryResult.owner);
    });
  });

  describe('Сценарий 4: Чужой owner не может освободить блокировку', () => {
    it('попытка освободить блокировку с неправильным owner не удаётся', async () => {
      const owner = await tokenRefreshLock.acquire('session-1');

      await tokenRefreshLock.release('session-1', 'wrong-owner');

      const second = await tokenRefreshLock.acquire('session-1');
      expect(second.acquired).toBe(false);

      await tokenRefreshLock.release('session-1', owner.owner);
    });
  });

  describe('Сценарий 5: Проигравший ждёт освобождения через waitAndRetry', () => {
    it('проигравший запрос дожидается освобождения и затем получает блокировку', async () => {
      const winner = await tokenRefreshLock.acquire('session-1');

      const waitPromise = tokenRefreshLock.waitAndRetry('session-1', 5000);

      setTimeout(async () => {
        await tokenRefreshLock.release('session-1', winner.owner);
      }, 100);

      await expect(waitPromise).resolves.toBeUndefined();

      const retryResult = await tokenRefreshLock.acquire('session-1');
      expect(retryResult.acquired).toBe(true);

      await tokenRefreshLock.release('session-1', retryResult.owner);
    });
  });

  describe('Сценарий 6: waitAndRetry завершается с ошибкой, если блокировка не освобождена за переданный таймаут (в тесте — 1 секунда)', () => {
    it('если блокировка не освобождена за переданный таймаут (в тесте — 1 секунда) — бросает ошибку таймаута', async () => {
      await tokenRefreshLock.acquire('session-1');

      await expect(tokenRefreshLock.waitAndRetry('session-1', 1000))
        .rejects.toThrow('Timeout waiting for token refresh lock');
    });
  });

  describe('Сценарий 7: Блокировка автоматически истекает по TTL', () => {
    it('через 1 секунду блокировка освобождается сама (Redis TTL)', async () => {
      await tokenRefreshLock.acquire('session-ttl');

      await redisService.client.expire('refresh_lock:session-ttl', 1);

      await new Promise(resolve => setTimeout(resolve, 1500));

      const second = await tokenRefreshLock.acquire('session-ttl');
      expect(second.acquired).toBe(true);

      await tokenRefreshLock.release('session-ttl', second.owner);
    });
  });
});
