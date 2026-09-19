import { Test, TestingModule } from '@nestjs/testing';
import { idTokenPayload, initFixtures, refreshedTokenSet, validTokenSet } from '@tests/shared/fixtures/tokens.fixture';
import * as crypto from 'crypto';

import { RedisClient } from '@/infra/redis/redis.client';
import { AuthService } from '@/modules/auth/services/auth.service';
import { KeycloakClient } from '@/modules/auth/services/keycloak.service';
import { OAuthStateRepository } from '@/modules/auth/storage/oauth-state.repository';
import { SessionRepository } from '@/modules/sessions/repositories/session.repository';
import { UserSessionsRepository } from '@/modules/sessions/repositories/user-sessions.repository';
import { SessionService } from '@/modules/sessions/services/session.service';

// Мокаем KeycloakClient — проверяем логику AuthService, а не реальный Keycloak
jest.mock('@/modules/auth/services/keycloak.service');

describe('AuthService (integration, real Redis)', () => {
  let redis: RedisClient;
  let oauthState: OAuthStateRepository;
  let sessionService: SessionService;
  let authService: AuthService;
  let keycloak: jest.Mocked<KeycloakClient>;

  beforeAll(async () => {
    await initFixtures();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RedisClient,
        OAuthStateRepository,
        SessionRepository,
        UserSessionsRepository,
        SessionService,
        AuthService,
        {
          provide: KeycloakClient,
          useValue: { exchangeCode: jest.fn(), refreshTokens: jest.fn(), revokeRefreshToken: jest.fn() },
        },
      ],
    }).compile();

    redis = moduleRef.get(RedisClient);
    oauthState = moduleRef.get(OAuthStateRepository);
    sessionService = moduleRef.get(SessionService);
    authService = moduleRef.get(AuthService);
    keycloak = moduleRef.get(KeycloakClient) as jest.Mocked<KeycloakClient>;

    await redis.onModuleInit();
  });

  afterAll(async () => {
    await redis.onModuleDestroy();
  });

  beforeEach(async () => {
    await redis.flushAll();
    jest.clearAllMocks();
  });

  describe('buildAuthorizationUrl', () => {
    it('генерирует PKCE-пару и сохраняет verifier в Redis по state', async () => {
      const url = await authService.buildAuthorizationUrl();
      const parsed = new URL(url);

      expect(parsed.pathname).toContain('/protocol/openid-connect/auth');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('client_id')).toBe('bff-client');

      const state = parsed.searchParams.get('state')!;
      const codeChallenge = parsed.searchParams.get('code_challenge')!;
      expect(state).toBeTruthy();
      expect(codeChallenge).toBeTruthy();

      const verifier = await oauthState.find(state);
      expect(verifier).toBeTruthy();

      const expectedChallenge = crypto.createHash('sha256').update(verifier!).digest('base64url');
      expect(codeChallenge).toBe(expectedChallenge);
    });
  });

  describe('exchangeCode', () => {
    it('обменивает code на токены, создаёт сессию и удаляет state', async () => {
      const state = 'test-state';
      const verifier = 'test-verifier';
      await oauthState.save(state, verifier);

      keycloak.exchangeCode.mockResolvedValue(validTokenSet);

      const session = await authService.exchangeCode('test-code', state);

      const storedVerifier = await oauthState.find(state);
      expect(storedVerifier).toBeNull();

      const storedSession = await sessionService.get(session.id);
      expect(storedSession).toBeDefined();
      expect(storedSession!.user.id).toBe(idTokenPayload.sub);
      expect(storedSession!.tokens.accessToken).toBe(validTokenSet.access_token);
      expect(storedSession!.csrfToken).toBeDefined();

      expect(keycloak.exchangeCode).toHaveBeenCalledWith('test-code', verifier);
    });

    it('бросает BadRequestException, если state не найден', async () => {
      await expect(authService.exchangeCode('code', 'nonexistent'))
        .rejects.toThrow('Invalid or expired OAuth state');
    });
  });

  describe('refreshTokens', () => {
    it('обновляет токены в сессии и сохраняет их в Redis', async () => {
      const session = await sessionService.create(idTokenPayload, validTokenSet, idTokenPayload.sub);
      keycloak.refreshTokens.mockResolvedValue(refreshedTokenSet);

      const newTokens = await authService.refreshTokens(session.id, session.tokens);

      expect(newTokens.accessToken).toBe(refreshedTokenSet.access_token);

      const updatedSession = await sessionService.get(session.id);
      expect(updatedSession!.tokens.accessToken).toBe(refreshedTokenSet.access_token);
      expect(keycloak.refreshTokens).toHaveBeenCalledWith(validTokenSet.refresh_token);
    });
  });

  describe('logout', () => {
    it('удаляет сессию, отзывает refresh и возвращает URL', async () => {
      const session = await sessionService.create(idTokenPayload, validTokenSet, idTokenPayload.sub);
      keycloak.revokeRefreshToken.mockResolvedValue(undefined);

      const logoutUrl = await authService.logout(session);

      expect(await sessionService.get(session.id)).toBeNull();
      expect(keycloak.revokeRefreshToken).toHaveBeenCalledWith(validTokenSet.refresh_token);
      expect(logoutUrl).toContain('protocol/openid-connect/logout');
      expect(logoutUrl).toContain('id_token_hint=' + validTokenSet.id_token);
    });
  });
});
