import { Test, TestingModule } from '@nestjs/testing';
import { signTestJwt, TEST_JWT_PUBLIC_KEY } from '@tests/shared/fixtures/jwt-keys';
import { idTokenPayload, validTokenSet } from '@tests/shared/fixtures/tokens.fixture';
import * as crypto from 'crypto';

import { AppConfigService } from '@/config/app-config.service';
import { RedisClient } from '@/infra/redis/redis.client';
import { AuthService } from '@/modules/auth/services/auth.service';
import { JwksService } from '@/modules/auth/services/jwks.service';
import { KeycloakClient } from '@/modules/auth/services/keycloak.service';
import { OAuthStateRepository } from '@/modules/auth/storage/oauth-state.repository';
import { SessionRepository } from '@/modules/sessions/repositories/session.repository';
import { UserSessionsRepository } from '@/modules/sessions/repositories/user-sessions.repository';
import { SessionService } from '@/modules/sessions/services/session.service';
import { AppLogger } from '@/shared/logger/app-logger.service';

jest.mock('@/modules/auth/services/keycloak.service');

describe('AuthService (integration, real Redis)', () => {
  let appConfig: AppConfigService;
  let redis: RedisClient;
  let oauthState: OAuthStateRepository;
  let sessionService: SessionService;
  let authService: AuthService;
  let keycloak: jest.Mocked<KeycloakClient>;

  beforeAll(async () => {
    const loggerMock = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as AppLogger;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        { provide: AppLogger, useValue: loggerMock },
        RedisClient,
        OAuthStateRepository,
        SessionRepository,
        UserSessionsRepository,
        SessionService,
        AuthService,
        { provide: JwksService, useValue: { getJWKS: () => TEST_JWT_PUBLIC_KEY } },
        {
          provide: KeycloakClient,
          useValue: { exchangeCode: jest.fn(), refreshTokens: jest.fn(), revokeRefreshToken: jest.fn() },
        },
      ],
    }).compile();

    appConfig = moduleRef.get(AppConfigService);
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
    it('генерирует PKCE + state + nonce и сохраняет в Redis', async () => {
      const url = await authService.buildAuthorizationUrl();
      const parsed = new URL(url);

      const state = parsed.searchParams.get('state')!;
      const codeChallenge = parsed.searchParams.get('code_challenge')!;
      const nonce = parsed.searchParams.get('nonce')!;

      expect(state).toBeTruthy();
      expect(codeChallenge).toBeTruthy();
      expect(nonce).toBeTruthy();

      const stored = await oauthState.find(state);
      expect(stored).toBeTruthy();
      expect(stored!.nonce).toBe(nonce);

      const expected = crypto.createHash('sha256').update(stored!.codeVerifier).digest('base64url');
      expect(codeChallenge).toBe(expected);
    });
  });

  describe('exchangeCode', () => {
    it('обменивает code, верифицирует id_token, создаёт сессию', async () => {
      const state = 'integration-state';
      const nonce = 'integration-nonce';
      await oauthState.save(state, { codeVerifier: 'verifier', nonce });

      const idToken = await signTestJwt(
        { email: 'u@e.com', preferred_username: 'u', nonce },
        {
          subject: idTokenPayload.sub,
          issuer: appConfig.keycloak.publicIssuer,
          audience: appConfig.keycloak.clientId,
        },
      );
      keycloak.exchangeCode.mockResolvedValue({ ...validTokenSet, id_token: idToken });

      const session = await authService.exchangeCode('test-code', state);

      expect(await oauthState.find(state)).toBeNull();
      const stored = await sessionService.get(session.id);
      expect(stored).toBeDefined();
      expect(stored!.user.id).toBe(idTokenPayload.sub);
    });

    it('бросает BadRequestException, если state не найден', async () => {
      await expect(authService.exchangeCode('code', 'nonexistent'))
        .rejects.toThrow('Invalid or expired OAuth state');
    });
  });

  describe('refreshTokens', () => {
    it('обновляет токены в сессии и сохраняет в Redis', async () => {
      const session = await sessionService.create(idTokenPayload, validTokenSet, idTokenPayload.sub);
      keycloak.refreshTokens.mockResolvedValue({
        access_token: 'new-a', refresh_token: 'new-r', id_token: 'new-i',
      });

      const newTokens = await authService.refreshTokens(session.id, session.tokens);

      expect(newTokens.accessToken).toBe('new-a');
      const updated = await sessionService.get(session.id);
      expect(updated!.tokens.accessToken).toBe('new-a');
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
    });
  });
});
