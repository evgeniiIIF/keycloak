import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RedisService } from './redis.service';
import { KeycloakClient } from './keycloak-client';
import { BffSession } from '../types/session';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

function createMockSession(overrides: Partial<BffSession> = {}): BffSession {
  return {
    id: 'session-123',
    oauth: { state: 'test-state', codeVerifier: 'test-verifier' },
    accessToken: undefined,
    refreshToken: undefined,
    idToken: undefined,
    userInfo: undefined,
    ...overrides,
  } as unknown as BffSession;
}

describe('AuthService', () => {
  let service: AuthService;
  let redis: jest.Mocked<RedisService>;
  let keycloak: jest.Mocked<KeycloakClient>;

  beforeEach(() => {
    redis = {
      addUserSession: jest.fn().mockResolvedValue(undefined),
      removeUserSession: jest.fn().mockResolvedValue(undefined),
      refreshUserSessionTtl: jest.fn().mockResolvedValue(undefined),
      refreshSessionStoreTtl: jest.fn().mockResolvedValue(undefined),
      getUserSessions: jest.fn().mockResolvedValue([]),
      deleteUserSessions: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RedisService>;

    keycloak = {
      exchangeCode: jest.fn(),
      refreshTokens: jest.fn(),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<KeycloakClient>;

    service = new AuthService(redis, keycloak);
  });

  describe('handleCallback', () => {
    it('throws if no pending oauth', async () => {
      const session = createMockSession({ oauth: undefined });
      await expect(service.handleCallback('code', 'state', session)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws on state mismatch', async () => {
      const session = createMockSession();
      await expect(service.handleCallback('code', 'wrong-state', session)).rejects.toThrow(
        'State mismatch',
      );
    });

    it('exchanges code, sets tokens and userInfo, registers session', async () => {
      const idToken = makeJwt({
        sub: 'user-1',
        email: 'test@example.com',
        preferred_username: 'testuser',
        name: 'Test User',
      });

      keycloak.exchangeCode.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        id_token: idToken,
      });

      const session = createMockSession();
      await service.handleCallback('code', 'test-state', session);

      expect(session.accessToken).toBe('at');
      expect(session.refreshToken).toBe('rt');
      expect(session.idToken).toBe(idToken);
      expect(session.userInfo).toEqual({
        sub: 'user-1',
        email: 'test@example.com',
        preferred_username: 'testuser',
        name: 'Test User',
      });
      expect(session.oauth).toBeUndefined();
      expect(redis.addUserSession).toHaveBeenCalledWith('user-1', 'session-123');
    });
  });

  describe('refreshTokens', () => {
    it('throws if no refresh token', async () => {
      const session = createMockSession({ refreshToken: undefined });
      await expect(service.refreshTokens(session)).rejects.toThrow('No refresh token');
    });

    it('refreshes tokens and updates session', async () => {
      const idToken = makeJwt({
        sub: 'user-1',
        email: 'test@example.com',
        preferred_username: 'testuser',
        name: 'Test User',
      });

      keycloak.refreshTokens.mockResolvedValue({
        access_token: 'new-at',
        refresh_token: 'new-rt',
        id_token: idToken,
      });

      const session = createMockSession({ refreshToken: 'old-rt' });
      const result = await service.refreshTokens(session);

      expect(result).toEqual({ accessToken: 'new-at', refreshToken: 'new-rt' });
      expect(session.accessToken).toBe('new-at');
      expect(session.refreshToken).toBe('new-rt');
      expect(redis.refreshUserSessionTtl).toHaveBeenCalledWith('user-1');
      expect(redis.refreshSessionStoreTtl).toHaveBeenCalledWith('session-123');
    });

    it('refreshes without id_token (no userInfo update)', async () => {
      keycloak.refreshTokens.mockResolvedValue({
        access_token: 'new-at',
        refresh_token: 'new-rt',
      });

      const session = createMockSession({ refreshToken: 'old-rt' });
      const result = await service.refreshTokens(session);

      expect(result).toEqual({ accessToken: 'new-at', refreshToken: 'new-rt' });
      expect(session.idToken).toBeUndefined();
    });
  });

  describe('getLogoutUrl', () => {
    it('builds correct logout URL', () => {
      const url = service.getLogoutUrl('my-id-token');
      expect(url).toContain('/protocol/openid-connect/logout');
      expect(url).toContain('id_token_hint=my-id-token');
    });
  });

  describe('destroyUserSessions', () => {
    it('does nothing when no sessions', async () => {
      redis.getUserSessions.mockResolvedValue([]);
      await service.destroyUserSessions('user-1');
      expect(redis.deleteUserSessions).not.toHaveBeenCalled();
    });

    it('deletes sessions when they exist', async () => {
      redis.getUserSessions.mockResolvedValue(['s1', 's2']);
      await service.destroyUserSessions('user-1');
      expect(redis.deleteUserSessions).toHaveBeenCalledWith('user-1');
    });
  });
});
