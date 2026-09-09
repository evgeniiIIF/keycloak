import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { RedisService } from '@/redis/services/redis.service';
import { SessionService } from '@/session/services/session.service';
import { KeycloakJwtPayload, TokenSet } from '@/types/keycloak';

describe('SessionService (unit)', () => {
  let sessionService: SessionService;
  let redisClientMock: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    eval: jest.Mock;
  };
  let redisServiceMock: jest.Mocked<RedisService>;

  beforeEach(async () => {
    redisClientMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      eval: jest.fn(),
    };

    redisServiceMock = {
      client: redisClientMock,
      addUserSession: jest.fn(),
      removeUserSession: jest.fn(),
      deleteUserSessions: jest.fn(),
      refreshSessionStoreTtl: jest.fn(),
      refreshUserSessionTtl: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    sessionService = moduleRef.get(SessionService);
  });

  const idPayload: KeycloakJwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    preferred_username: 'testuser',
    name: 'Test User',
    realm_access: { roles: ['user'] },
    resource_access: {},
  };

  const tokenSet: TokenSet = {
    access_token: 'access',
    refresh_token: 'refresh',
    id_token: 'id',
  };

  describe('create', () => {
    it('создаёт сессию, сохраняет в Redis и связывает с пользователем', async () => {
      redisClientMock.set.mockResolvedValue('OK');
      redisServiceMock.addUserSession.mockResolvedValue(undefined);

      const session = await sessionService.create(idPayload, tokenSet, 'user-123');

      expect(session.id).toBeDefined();
      expect(session.user.id).toBe('user-123');
      expect(session.user.username).toBe('testuser');
      expect(session.tokens.accessToken).toBe('access');

      expect(redisClientMock.set).toHaveBeenCalled();
      expect(redisServiceMock.addUserSession).toHaveBeenCalledWith('user-123', session.id);
    });
  });

  describe('get', () => {
    it('возвращает сессию, если она существует в Redis', async () => {
      const session = {
        id: 'session-1',
        user: { id: 'user-123', username: 'testuser', email: 'test@example.com', roles: [] },
        tokens: { accessToken: 'access', refreshToken: 'refresh', idToken: 'id' },
      };
      redisClientMock.get.mockResolvedValue(JSON.stringify(session));

      const result = await sessionService.get('session-1');

      expect(result).toEqual(session);
    });

    it('возвращает null, если сессии нет в Redis', async () => {
      redisClientMock.get.mockResolvedValue(null);

      const result = await sessionService.get('nonexistent');

      expect(result).toBeNull();
    });

    it('возвращает null, если JSON повреждён', async () => {
      redisClientMock.get.mockResolvedValue('invalid-json');

      const result = await sessionService.get('session-1');

      expect(result).toBeNull();
    });
  });

  describe('updateTokens', () => {
    it('вызывает Lua-скрипт для атомарного обновления токенов', async () => {
      redisClientMock.eval.mockResolvedValue(1);

      const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh', idToken: 'new-id' };

      await sessionService.updateTokens('session-1', newTokens);

      expect(redisClientMock.eval).toHaveBeenCalled();
    });

    it('бросает UnauthorizedException, если сессия не найдена', async () => {
      redisClientMock.eval.mockResolvedValue(null);

      const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh', idToken: 'new-id' };

      await expect(sessionService.updateTokens('nonexistent', newTokens))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('destroy', () => {
    it('удаляет сессию и связь с пользователем', async () => {
      redisClientMock.del.mockResolvedValue(1);
      redisServiceMock.removeUserSession.mockResolvedValue(undefined);

      await sessionService.destroy('session-1', 'user-123');

      expect(redisClientMock.del).toHaveBeenCalled();
      expect(redisServiceMock.removeUserSession).toHaveBeenCalledWith('user-123', 'session-1');
    });
  });

  describe('destroyAllSessions', () => {
    it('удаляет все сессии пользователя', async () => {
      redisServiceMock.deleteUserSessions.mockResolvedValue(undefined);

      await sessionService.destroyAllSessions('user-123');

      expect(redisServiceMock.deleteUserSessions).toHaveBeenCalledWith('user-123');
    });
  });

  describe('touch', () => {
    it('продлевает TTL сессии и связи с пользователем', async () => {
      redisServiceMock.refreshSessionStoreTtl.mockResolvedValue(undefined);
      redisServiceMock.refreshUserSessionTtl.mockResolvedValue(undefined);

      await sessionService.touch('session-1', 'user-123');

      expect(redisServiceMock.refreshSessionStoreTtl).toHaveBeenCalledWith('session-1');
      expect(redisServiceMock.refreshUserSessionTtl).toHaveBeenCalledWith('user-123');
    });
  });
});
