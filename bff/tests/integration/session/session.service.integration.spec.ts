import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { RedisService } from '@/infra/redis/services/redis.service';
import { SessionService } from '@/modules/auth/sessions/services/session.service';
import { KeycloakJwtPayload, TokenSet } from '@/modules/auth/types/keycloak';

describe('SessionService (integration)', () => {
  let sessionService: SessionService;
  let redisService: RedisService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [RedisService, SessionService],
    }).compile();

    redisService = moduleRef.get(RedisService);
    sessionService = moduleRef.get(SessionService);

    await redisService.onModuleInit();
  });

  afterAll(async () => {
    await redisService.onModuleDestroy();
  });

  beforeEach(async () => {
    await redisService.client.flushAll();
  });

  const idPayload: KeycloakJwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    preferred_username: 'testuser',
    name: 'Test User',
    realm_access: { roles: ['user', 'admin'] },
    resource_access: {
      'bff-client': { roles: ['client-role'] },
    },
  };

  const tokenSet: TokenSet = {
    access_token: 'access',
    refresh_token: 'refresh',
    id_token: 'id',
  };

  describe('Сценарий 1: Создание и чтение сессии', () => {
    it('создаёт сессию в реальном Redis и читает её обратно', async () => {
      const session = await sessionService.create(idPayload, tokenSet, 'user-123');

      const stored = await sessionService.get(session.id);

      expect(stored).toBeDefined();
      expect(stored!.id).toBe(session.id);
      expect(stored!.user.id).toBe('user-123');
      expect(stored!.tokens.accessToken).toBe('access');
    });

    it('возвращает null для несуществующей сессии', async () => {
      const result = await sessionService.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('Сценарий 2: Обновление токенов через Lua-скрипт', () => {
    it('атомарно обновляет токены в сессии', async () => {
      const session = await sessionService.create(idPayload, tokenSet, 'user-123');

      const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh', idToken: 'new-id' };
      await sessionService.updateTokens(session.id, newTokens);

      const updated = await sessionService.get(session.id);
      expect(updated!.tokens.accessToken).toBe('new-access');
      expect(updated!.tokens.refreshToken).toBe('new-refresh');
    });

    it('бросает UnauthorizedException для несуществующей сессии', async () => {
      const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh', idToken: 'new-id' };

      await expect(sessionService.updateTokens('nonexistent', newTokens))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Сценарий 3: Удаление сессии', () => {
    it('удаляет сессию и связь с пользователем', async () => {
      const session = await sessionService.create(idPayload, tokenSet, 'user-123');

      await sessionService.destroy(session.id, 'user-123');

      expect(await sessionService.get(session.id)).toBeNull();
    });
  });

  describe('Сценарий 4: Удаление всех сессий пользователя', () => {
    it('удаляет все сессии пользователя из Redis', async () => {
      const session1 = await sessionService.create(idPayload, tokenSet, 'user-123');
      const session2 = await sessionService.create(idPayload, tokenSet, 'user-123');

      expect(await sessionService.get(session1.id)).toBeDefined();
      expect(await sessionService.get(session2.id)).toBeDefined();

      await sessionService.destroyAllSessions('user-123');

      expect(await sessionService.get(session1.id)).toBeNull();
      expect(await sessionService.get(session2.id)).toBeNull();
    });
  });

  describe('Сценарий 5: Роли пользователя извлекаются правильно', () => {
    it('объединяет realm и client роли', async () => {
      const session = await sessionService.create(idPayload, tokenSet, 'user-123');

      expect(session.user.roles).toContain('user');
      expect(session.user.roles).toContain('admin');
      expect(session.user.roles).toContain('client-role');
    });
  });
});
