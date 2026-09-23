import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppConfigService } from '@/config/app-config.service';
import { RedisClient } from '@/infra/redis/redis.client';
import { KeycloakJwtPayload, TokenSet } from '@/modules/auth/types/keycloak';
import { SessionRepository } from '@/modules/sessions/repositories/session.repository';
import { UserSessionsRepository } from '@/modules/sessions/repositories/user-sessions.repository';
import { SessionService } from '@/modules/sessions/services/session.service';
import { AppLogger } from '@/shared/logger/app-logger.service';

describe('SessionService (integration, real Redis)', () => {
  let redis: RedisClient;
  let sessionService: SessionService;

  beforeAll(async () => {
    const loggerMock = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as AppLogger;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [AppConfigService, { provide: AppLogger, useValue: loggerMock }, RedisClient, SessionRepository, UserSessionsRepository, SessionService],
    }).compile();

    redis = moduleRef.get(RedisClient);
    sessionService = moduleRef.get(SessionService);

    await redis.onModuleInit();
  });

  afterAll(async () => {
    await redis.onModuleDestroy();
  });

  beforeEach(async () => {
    await redis.flushAll();
  });

  const idPayload: KeycloakJwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    preferred_username: 'testuser',
    name: 'Test User',
    realm_access: { roles: ['user', 'admin'] },
    resource_access: { 'bff-client': { roles: ['client-role'] } },
  };

  const tokenSet: TokenSet = {
    access_token: 'access', refresh_token: 'refresh', id_token: 'id',
  };

  describe('create / get', () => {
    it('создаёт сессию в Redis и читает обратно', async () => {
      const session = await sessionService.create(idPayload, tokenSet, 'user-123');
      const stored = await sessionService.get(session.id);

      expect(stored).toBeDefined();
      expect(stored!.id).toBe(session.id);
      expect(stored!.user.id).toBe('user-123');
      expect(stored!.tokens.accessToken).toBe('access');
    });

    it('возвращает null для несуществующей сессии', async () => {
      expect(await sessionService.get('nonexistent')).toBeNull();
    });
  });

  describe('updateTokens', () => {
    it('атомарно обновляет токены через Lua-скрипт', async () => {
      const session = await sessionService.create(idPayload, tokenSet, 'user-123');
      const newTokens = { accessToken: 'new-a', refreshToken: 'new-r', idToken: 'new-i' };

      await sessionService.updateTokens(session.id, newTokens);

      const updated = await sessionService.get(session.id);
      expect(updated!.tokens.accessToken).toBe('new-a');
      expect(updated!.tokens.refreshToken).toBe('new-r');
    });

    it('бросает UnauthorizedException для несуществующей сессии', async () => {
      const newTokens = { accessToken: 'a', refreshToken: 'r', idToken: 'i' };
      await expect(sessionService.updateTokens('nonexistent', newTokens))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('destroy', () => {
    it('удаляет сессию и связь с пользователем', async () => {
      const session = await sessionService.create(idPayload, tokenSet, 'user-123');
      await sessionService.destroy(session.id, 'user-123');
      expect(await sessionService.get(session.id)).toBeNull();
    });
  });

  describe('destroyAllSessions', () => {
    it('удаляет все сессии пользователя', async () => {
      const s1 = await sessionService.create(idPayload, tokenSet, 'user-123');
      const s2 = await sessionService.create(idPayload, tokenSet, 'user-123');

      await sessionService.destroyAllSessions('user-123');

      expect(await sessionService.get(s1.id)).toBeNull();
      expect(await sessionService.get(s2.id)).toBeNull();
    });
  });

  describe('roles', () => {
    it('объединяет realm и client роли', async () => {
      const session = await sessionService.create(idPayload, tokenSet, 'user-123');
      expect(session.user.roles).toContain('user');
      expect(session.user.roles).toContain('admin');
      expect(session.user.roles).toContain('client-role');
    });
  });
});
