import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { initFixtures, validTokenSet } from '@test/shared/fixtures/tokens.fixture';

import { AuthService } from '@/auth/services/auth.service';
import { KeycloakClient } from '@/auth/services/keycloak.service';
import { RedisService } from '@/redis/services/redis.service';
import { SessionService } from '@/session/services/session.service';

describe('AuthService (unit)', () => {
  let authService: AuthService;
  let redisServiceMock: jest.Mocked<RedisService>;
  let sessionServiceMock: jest.Mocked<SessionService>;
  let keycloakClientMock: jest.Mocked<KeycloakClient>;

  beforeEach(async () => {
    // Инициализируем валидный id_token
    await initFixtures();

    // Создаём моки для всех зависимостей
    redisServiceMock = {
      setOAuthState: jest.fn(),
      getOAuthState: jest.fn(),
      deleteOAuthState: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    sessionServiceMock = {
      create: jest.fn(),
      updateTokens: jest.fn(),
      destroy: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    keycloakClientMock = {
      exchangeCode: jest.fn(),
      refreshTokens: jest.fn(),
      revokeRefreshToken: jest.fn(),
    } as unknown as jest.Mocked<KeycloakClient>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: RedisService, useValue: redisServiceMock },
        { provide: SessionService, useValue: sessionServiceMock },
        { provide: KeycloakClient, useValue: keycloakClientMock },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe('buildAuthorizationUrl', () => {
    it('генерирует PKCE-пару и сохраняет verifier в Redis', async () => {
      const url = await authService.buildAuthorizationUrl();
      const parsed = new URL(url);

      expect(parsed.pathname).toContain('/protocol/openid-connect/auth');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('client_id')).toBe('bff-client');
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');

      expect(redisServiceMock.setOAuthState).toHaveBeenCalled();

      const state = parsed.searchParams.get('state');
      expect(state).toBeTruthy();
      expect(redisServiceMock.setOAuthState).toHaveBeenCalledWith(state, expect.any(String));
    });
  });

  describe('exchangeCode', () => {
    const session = {
      id: 'session-123',
      user: { id: 'user-123', username: 'testuser', email: 'test@example.com', roles: [] },
      tokens: { accessToken: 'access', refreshToken: 'refresh', idToken: 'id' },
    };

    it('успешно обменивает code, создаёт сессию и удаляет state', async () => {
      redisServiceMock.getOAuthState.mockResolvedValue('verifier-123');
      keycloakClientMock.exchangeCode.mockResolvedValue(validTokenSet);
      sessionServiceMock.create.mockResolvedValue(session);

      const sessionId = await authService.exchangeCode('code-123', 'state-123');

      expect(sessionId).toBe('session-123');
      expect(redisServiceMock.getOAuthState).toHaveBeenCalledWith('state-123');
      expect(keycloakClientMock.exchangeCode).toHaveBeenCalledWith('code-123', 'verifier-123');
      expect(sessionServiceMock.create).toHaveBeenCalled();
      expect(redisServiceMock.deleteOAuthState).toHaveBeenCalledWith('state-123');
    });

    it('бросает BadRequestException, если state не найден', async () => {
      redisServiceMock.getOAuthState.mockResolvedValue(null);

      await expect(authService.exchangeCode('code', 'state'))
        .rejects.toThrow(BadRequestException);
    });

    it('пробрасывает ошибку от KeycloakClient', async () => {
      redisServiceMock.getOAuthState.mockResolvedValue('verifier');
      keycloakClientMock.exchangeCode.mockRejectedValue(new Error('Keycloak error'));

      await expect(authService.exchangeCode('code', 'state'))
        .rejects.toThrow('Keycloak error');
    });
  });

  describe('refreshTokens', () => {
    const currentTokens = {
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      idToken: 'old-id',
    };

    const newTokenSet = {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      id_token: 'new-id',
    };

    it('обновляет токены через Keycloak и сохраняет в сессии', async () => {
      keycloakClientMock.refreshTokens.mockResolvedValue(newTokenSet);

      const newTokens = await authService.refreshTokens('session-123', currentTokens);

      expect(keycloakClientMock.refreshTokens).toHaveBeenCalledWith('old-refresh');
      expect(sessionServiceMock.updateTokens).toHaveBeenCalledWith('session-123', {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        idToken: 'new-id',
      });
      expect(newTokens.accessToken).toBe('new-access');
      expect(newTokens.refreshToken).toBe('new-refresh');
    });

    it('использует старый refresh token, если Keycloak не вернул новый', async () => {
      keycloakClientMock.refreshTokens.mockResolvedValue({
        access_token: 'new-access',
        refresh_token: '',
        id_token: 'new-id',
      });

      const newTokens = await authService.refreshTokens('session-123', currentTokens);

      expect(newTokens.refreshToken).toBe('old-refresh');
    });
  });

  describe('logout', () => {
    const session = {
      id: 'session-123',
      user: { id: 'user-123', username: 'testuser', email: 'test@example.com', roles: [] },
      tokens: { accessToken: 'access', refreshToken: 'refresh', idToken: 'id-token' },
    };

    it('удаляет сессию, отзывает refresh token и возвращает URL', async () => {
      sessionServiceMock.destroy.mockResolvedValue(undefined);
      keycloakClientMock.revokeRefreshToken.mockResolvedValue(undefined);

      const logoutUrl = await authService.logout(session);

      expect(sessionServiceMock.destroy).toHaveBeenCalledWith('session-123', 'user-123');
      expect(keycloakClientMock.revokeRefreshToken).toHaveBeenCalledWith('refresh');
      expect(logoutUrl).toContain('id_token_hint=id-token');
      expect(logoutUrl).toContain('post_logout_redirect_uri');
    });

    it('не бросает ошибку, если отзыв refresh token не удался', async () => {
      sessionServiceMock.destroy.mockResolvedValue(undefined);
      keycloakClientMock.revokeRefreshToken.mockRejectedValue(new Error('Revoke failed'));

      const logoutUrl = await authService.logout(session);

      expect(logoutUrl).toContain('id_token_hint=id-token');
    });
  });
});
