import { Test, TestingModule } from '@nestjs/testing';
import { BackchannelService } from '../backchannel.service';
import { JwksService } from '../jwks.service';
import { RedisService } from '../../../redis/services/redis.service';
import { SessionService } from '../../../session/services/session.service';

describe('BackchannelService (integration)', () => {
  let backchannelService: BackchannelService;
  let redisService: RedisService;
  let sessionService: SessionService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        SessionService,
        JwksService,
        BackchannelService,
      ],
    }).compile();

    redisService = moduleRef.get(RedisService);
    sessionService = moduleRef.get(SessionService);
    backchannelService = moduleRef.get(BackchannelService);

    await redisService.onModuleInit();
  });

  afterAll(async () => {
    await redisService.onModuleDestroy();
  });

  beforeEach(async () => {
    await redisService.client.flushAll();
  });

  it('replay protection работает с реальным Redis', async () => {
    // Мокаем verifyLogoutToken — это unit-задача
    (backchannelService as unknown as { verifyLogoutToken: jest.Mock }).verifyLogoutToken = jest.fn().mockResolvedValue({
      sub: 'user-123',
      jti: 'integration-jti-123',
      events: {
        'http://schemas.openid.net/event/backchannel-logout': {},
      },
    });

    // Первый вызов — успех
    await backchannelService.handleBackchannelLogout('token');

    // Проверяем, что jti сохранён в реальном Redis
    const exists = await redisService.client.exists('replay:integration-jti-123');
    expect(exists).toBe(1);

    // Второй вызов — replay detected
    await expect(backchannelService.handleBackchannelLogout('token'))
      .rejects.toThrow('Replay detected');
  });

  it('destroyAllSessions удаляет все сессии пользователя из реального Redis', async () => {
    // Создаём две сессии для пользователя
    const tokens = {
      access_token: 'access',
      refresh_token: 'refresh',
      id_token: 'id',
    };
    const idPayload = {
      sub: 'integration-user-123',
      email: 'test@example.com',
      preferred_username: 'testuser',
      name: 'Test User',
      realm_access: { roles: ['user'] },
      resource_access: {},
    };

    const session1 = await sessionService.create(idPayload, tokens, idPayload.sub);
    const session2 = await sessionService.create(idPayload, tokens, idPayload.sub);

    // Убеждаемся, что сессии существуют
    expect(await sessionService.get(session1.id)).toBeDefined();
    expect(await sessionService.get(session2.id)).toBeDefined();

    // Вызываем destroyAllSessions
    await sessionService.destroyAllSessions(idPayload.sub);

    // Проверяем, что обе сессии удалены
    expect(await sessionService.get(session1.id)).toBeNull();
    expect(await sessionService.get(session2.id)).toBeNull();
  });
});
