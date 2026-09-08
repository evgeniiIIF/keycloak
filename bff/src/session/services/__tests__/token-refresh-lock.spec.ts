import { Test, TestingModule } from '@nestjs/testing';
import { TokenRefreshLock } from '../token-refresh-lock.service';
import { RedisService } from '../../../redis/services/redis.service';

describe('TokenRefreshLock (unit)', () => {
  let tokenRefreshLock: TokenRefreshLock;
  let redisClientMock: {
    set: jest.Mock;
    exists: jest.Mock;
    eval: jest.Mock;
  };

  beforeEach(async () => {
    redisClientMock = {
      set: jest.fn(),
      exists: jest.fn(),
      eval: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TokenRefreshLock,
        { provide: RedisService, useValue: { client: redisClientMock } },
      ],
    }).compile();

    tokenRefreshLock = moduleRef.get(TokenRefreshLock);
  });

  it('acquire возвращает true и owner, если Redis.set вернул OK', async () => {
    redisClientMock.set.mockResolvedValue('OK');

    const result = await tokenRefreshLock.acquire('session-1');

    expect(result.acquired).toBe(true);
    expect(result.owner).toBeDefined();
  });

  it('acquire возвращает false, если Redis.set вернул null', async () => {
    redisClientMock.set.mockResolvedValue(null);

    const result = await tokenRefreshLock.acquire('session-1');

    expect(result.acquired).toBe(false);
  });

  it('release вызывает Redis.eval с правильными аргументами', async () => {
    redisClientMock.eval.mockResolvedValue(1);

    await tokenRefreshLock.release('session-1', 'owner-123');

    expect(redisClientMock.eval).toHaveBeenCalled();
  });
});
