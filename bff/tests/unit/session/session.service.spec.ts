import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { KeycloakJwtPayload, TokenSet } from '@/modules/auth/types/keycloak';
import { Session } from '@/modules/auth/types/session';
import { SessionRepository } from '@/modules/sessions/repositories/session.repository';
import { UserSessionsRepository } from '@/modules/sessions/repositories/user-sessions.repository';
import { SessionService } from '@/modules/sessions/services/session.service';

describe('SessionService (unit)', () => {
  let sessionService: SessionService;
  let sessions: jest.Mocked<SessionRepository>;
  let userSessions: jest.Mocked<UserSessionsRepository>;

  beforeEach(async () => {
    sessions = {
      save: jest.fn(),
      find: jest.fn(),
      updateTokens: jest.fn(),
      touch: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<SessionRepository>;

    userSessions = {
      add: jest.fn(),
      remove: jest.fn(),
      findAll: jest.fn(),
      touch: jest.fn(),
      deleteIndex: jest.fn(),
    } as unknown as jest.Mocked<UserSessionsRepository>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: SessionRepository, useValue: sessions },
        { provide: UserSessionsRepository, useValue: userSessions },
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
    resource_access: { 'bff-client': { roles: ['admin'] } },
  };

  const tokenSet: TokenSet = {
    access_token: 'access',
    refresh_token: 'refresh',
    id_token: 'id',
  };

  describe('create', () => {
    it('собирает сессию, сохраняет её и индексирует по пользователю', async () => {
      const session = await sessionService.create(idPayload, tokenSet, 'user-123');

      expect(session.id).toBeDefined();
      expect(session.user.id).toBe('user-123');
      expect(session.user.username).toBe('testuser');
      expect(session.user.roles).toEqual(['user', 'admin']);
      expect(session.tokens.accessToken).toBe('access');
      expect(session.csrfToken).toHaveLength(64);

      expect(sessions.save).toHaveBeenCalledWith(session);
      expect(userSessions.add).toHaveBeenCalledWith('user-123', session.id);
    });
  });

  describe('get', () => {
    it('делегирует в SessionRepository.find', async () => {
      const session = { id: 'sess-1' } as Session;
      sessions.find.mockResolvedValue(session);

      const result = await sessionService.get('sess-1');

      expect(result).toBe(session);
      expect(sessions.find).toHaveBeenCalledWith('sess-1');
    });

    it('возвращает null, если репозиторий вернул null', async () => {
      sessions.find.mockResolvedValue(null);

      expect(await sessionService.get('missing')).toBeNull();
    });
  });

  describe('updateTokens', () => {
    const newTokens = { accessToken: 'a2', refreshToken: 'r2', idToken: 'i2' };

    it('обновляет токены, если репозиторий вернул true', async () => {
      sessions.updateTokens.mockResolvedValue(true);

      await sessionService.updateTokens('sess-1', newTokens);

      expect(sessions.updateTokens).toHaveBeenCalledWith('sess-1', newTokens);
    });

    it('бросает UnauthorizedException, если сессия исчезла', async () => {
      sessions.updateTokens.mockResolvedValue(false);

      await expect(sessionService.updateTokens('sess-1', newTokens))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('touch', () => {
    it('продлевает TTL сессии и индекса пользователя', async () => {
      await sessionService.touch('sess-1', 'user-123');

      expect(sessions.touch).toHaveBeenCalledWith('sess-1');
      expect(userSessions.touch).toHaveBeenCalledWith('user-123');
    });
  });

  describe('destroy', () => {
    it('удаляет сессию и убирает её из индекса пользователя', async () => {
      await sessionService.destroy('sess-1', 'user-123');

      expect(sessions.delete).toHaveBeenCalledWith('sess-1');
      expect(userSessions.remove).toHaveBeenCalledWith('user-123', 'sess-1');
    });
  });

  describe('destroyAllSessions', () => {
    it('удаляет все сессии пользователя и его индекс', async () => {
      userSessions.findAll.mockResolvedValue(['s1', 's2']);

      await sessionService.destroyAllSessions('user-123');

      expect(sessions.delete).toHaveBeenCalledWith('s1');
      expect(sessions.delete).toHaveBeenCalledWith('s2');
      expect(userSessions.deleteIndex).toHaveBeenCalledWith('user-123');
    });

    it('работает, если у пользователя нет сессий', async () => {
      userSessions.findAll.mockResolvedValue([]);

      await sessionService.destroyAllSessions('user-123');

      expect(sessions.delete).not.toHaveBeenCalled();
      expect(userSessions.deleteIndex).toHaveBeenCalledWith('user-123');
    });
  });
});
