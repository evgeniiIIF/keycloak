import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { signTestJwt, TEST_JWT_PUBLIC_KEY } from '@tests/shared/fixtures/jwt-keys';
import { initFixtures, validTokenSet } from '@tests/shared/fixtures/tokens.fixture';

import { AuthService } from '@/modules/auth/services/auth.service';
import { JwksService } from '@/modules/auth/services/jwks.service';
import { KeycloakClient } from '@/modules/auth/services/keycloak.service';
import { OAuthStateRepository } from '@/modules/auth/storage/oauth-state.repository';
import { Session } from '@/modules/auth/types/session';
import { SessionService } from '@/modules/sessions/services/session.service';

describe('AuthService (unit)', () => {
  let authService: AuthService;
  let oauthState: jest.Mocked<OAuthStateRepository>;
  let sessionService: jest.Mocked<SessionService>;
  let keycloak: jest.Mocked<KeycloakClient>;

  beforeEach(async () => {
    await initFixtures();

    oauthState = {
      save: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<OAuthStateRepository>;

    sessionService = {
      create: jest.fn(),
      updateTokens: jest.fn(),
      destroy: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    keycloak = {
      exchangeCode: jest.fn(),
      refreshTokens: jest.fn(),
      revokeRefreshToken: jest.fn(),
    } as unknown as jest.Mocked<KeycloakClient>;

    const jwks = {
      getJWKS: jest.fn().mockReturnValue(TEST_JWT_PUBLIC_KEY),
    } as unknown as jest.Mocked<JwksService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OAuthStateRepository, useValue: oauthState },
        { provide: SessionService, useValue: sessionService },
        { provide: KeycloakClient, useValue: keycloak },
        { provide: JwksService, useValue: jwks },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe('buildAuthorizationUrl', () => {
    it('генерирует PKCE-пару, state, nonce и сохраняет их', async () => {
      const url = await authService.buildAuthorizationUrl();
      const parsed = new URL(url);

      expect(parsed.pathname).toContain('/protocol/openid-connect/auth');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('client_id')).toBe('bff-client');
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsed.searchParams.get('nonce')).toBeTruthy();

      const state = parsed.searchParams.get('state')!;
      expect(state).toBeTruthy();
      expect(oauthState.save).toHaveBeenCalledWith(state, {
        codeVerifier: expect.any(String),
        nonce: expect.any(String),
      });
    });
  });

  describe('exchangeCode', () => {
    const session: Session = {
      id: 'session-123',
      user: { id: 'user-123', username: 'testuser', email: 'test@example.com', roles: [] },
      tokens: { accessToken: 'access', refreshToken: 'refresh', idToken: 'id' },
      csrfToken: 'csrf-token-123',
    };

    const nonce = 'test-nonce';

    it('обменивает code, верифицирует id_token, создаёт сессию и удаляет state', async () => {
      const idToken = await signTestJwt(
        { email: 'u@e.com', preferred_username: 'u', nonce },
        { subject: 'user-123' },
      );

      oauthState.find.mockResolvedValue({ codeVerifier: 'verifier-123', nonce });
      keycloak.exchangeCode.mockResolvedValue({ ...validTokenSet, id_token: idToken });
      sessionService.create.mockResolvedValue(session);

      const result = await authService.exchangeCode('code-123', 'state-123');

      expect(result).toBe(session);
      expect(oauthState.find).toHaveBeenCalledWith('state-123');
      expect(keycloak.exchangeCode).toHaveBeenCalledWith('code-123', 'verifier-123');
      expect(oauthState.delete).toHaveBeenCalledWith('state-123');
    });

    it('бросает BadRequestException, если state не найден', async () => {
      oauthState.find.mockResolvedValue(null);

      await expect(authService.exchangeCode('code', 'state'))
        .rejects.toThrow(BadRequestException);
    });

    it('бросает UnauthorizedException, если подпись id_token подделана', async () => {
      const forged = await signTestJwt({ nonce }, { subject: 'user-123' });
      // Портим символ в середине подписи — гарантированно меняет байты,
      // в отличие от последнего символа base64url (может быть padding).
      const [header, payload, signature] = forged.split('.');
      const tamperedSig = signature.slice(0, 10) + (signature[10] === 'A' ? 'B' : 'A') + signature.slice(11);
      const tampered = `${header}.${payload}.${tamperedSig}`;

      oauthState.find.mockResolvedValue({ codeVerifier: 'v', nonce });
      keycloak.exchangeCode.mockResolvedValue({ ...validTokenSet, id_token: tampered });

      await expect(authService.exchangeCode('code', 'state'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('бросает UnauthorizedException, если nonce не совпадает', async () => {
      const idToken = await signTestJwt(
        { nonce: 'wrong-nonce' },
        { subject: 'user-123' },
      );

      oauthState.find.mockResolvedValue({ codeVerifier: 'v', nonce: 'expected-nonce' });
      keycloak.exchangeCode.mockResolvedValue({ ...validTokenSet, id_token: idToken });

      await expect(authService.exchangeCode('code', 'state'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('бросает UnauthorizedException, если issuer не совпадает', async () => {
      const idToken = await signTestJwt(
        { nonce },
        { subject: 'user-123', issuer: 'http://evil' },
      );

      oauthState.find.mockResolvedValue({ codeVerifier: 'v', nonce });
      keycloak.exchangeCode.mockResolvedValue({ ...validTokenSet, id_token: idToken });

      await expect(authService.exchangeCode('code', 'state'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('бросает UnauthorizedException, если id_token просрочен', async () => {
      const idToken = await signTestJwt(
        { nonce },
        { subject: 'user-123', expiresIn: '-1s' },
      );

      oauthState.find.mockResolvedValue({ codeVerifier: 'v', nonce });
      keycloak.exchangeCode.mockResolvedValue({ ...validTokenSet, id_token: idToken });

      await expect(authService.exchangeCode('code', 'state'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    const currentTokens = { accessToken: 'old-a', refreshToken: 'old-r', idToken: 'old-i' };

    it('обновляет токены и сохраняет в сессии', async () => {
      keycloak.refreshTokens.mockResolvedValue({
        access_token: 'new-a', refresh_token: 'new-r', id_token: 'new-i',
      });

      const result = await authService.refreshTokens('session-123', currentTokens);

      expect(keycloak.refreshTokens).toHaveBeenCalledWith('old-r');
      expect(sessionService.updateTokens).toHaveBeenCalledWith('session-123', {
        accessToken: 'new-a', refreshToken: 'new-r', idToken: 'new-i',
      });
      expect(result.accessToken).toBe('new-a');
    });

    it('использует старый refresh token, если Keycloak не вернул новый', async () => {
      keycloak.refreshTokens.mockResolvedValue({
        access_token: 'new-a', refresh_token: '', id_token: 'new-i',
      });

      const result = await authService.refreshTokens('session-123', currentTokens);

      expect(result.refreshToken).toBe('old-r');
    });
  });

  describe('logout', () => {
    const session: Session = {
      id: 'session-123',
      user: { id: 'user-123', username: 'testuser', email: 'test@example.com', roles: [] },
      tokens: { accessToken: 'a', refreshToken: 'r', idToken: 'id-token' },
      csrfToken: 'csrf',
    };

    it('удаляет сессию, отзывает refresh и возвращает URL выхода', async () => {
      sessionService.destroy.mockResolvedValue(undefined);
      keycloak.revokeRefreshToken.mockResolvedValue(undefined);

      const logoutUrl = await authService.logout(session);

      expect(sessionService.destroy).toHaveBeenCalledWith('session-123', 'user-123');
      expect(keycloak.revokeRefreshToken).toHaveBeenCalledWith('r');
      expect(logoutUrl).toContain('id_token_hint=id-token');
      expect(logoutUrl).toContain('post_logout_redirect_uri');
    });

    it('не бросает, если отзыв refresh token упал', async () => {
      sessionService.destroy.mockResolvedValue(undefined);
      keycloak.revokeRefreshToken.mockRejectedValue(new Error('Revoke failed'));

      await expect(authService.logout(session)).resolves.toContain('id_token_hint=id-token');
    });

    it('не бросает, если удаление сессии упало', async () => {
      sessionService.destroy.mockRejectedValue(new Error('Destroy failed'));
      keycloak.revokeRefreshToken.mockResolvedValue(undefined);

      await expect(authService.logout(session)).resolves.toContain('id_token_hint=id-token');
    });
  });

  describe('validateCsrfToken', () => {
    const session = { csrfToken: 'a'.repeat(64) } as Session;

    it('возвращает true для совпадающих токенов', () => {
      expect(authService.validateCsrfToken(session, 'a'.repeat(64))).toBe(true);
    });

    it('возвращает false для несовпадающих', () => {
      expect(authService.validateCsrfToken(session, 'b'.repeat(64))).toBe(false);
    });

    it('возвращает false для undefined', () => {
      expect(authService.validateCsrfToken(session, undefined)).toBe(false);
    });

    it('возвращает false для разной длины', () => {
      expect(authService.validateCsrfToken(session, 'short')).toBe(false);
    });
  });
});
