import { Test, TestingModule } from '@nestjs/testing';
import { idTokenPayload, initFixtures, refreshedTokenSet, validTokenSet } from '@tests/shared/fixtures/tokens.fixture';
import * as crypto from 'crypto';

import { AuthService } from '@/auth/services/auth.service';
import { KeycloakClient } from '@/auth/services/keycloak.service';
import { RedisService } from '@/redis/services/redis.service';
import { SessionService } from '@/session/services/session.service';

// Мокаем KeycloakClient — в этом тесте проверяем логику AuthService,
// а не реальное взаимодействие с Keycloak
jest.mock('@/auth/services/keycloak.service');

describe('AuthService with Redis / AuthService с Redis', () => {
  let redisService: RedisService;
  let sessionService: SessionService;
  let authService: AuthService;
  let keycloakClientMock: jest.Mocked<KeycloakClient>;

  beforeAll(async () => {
    // Инициализируем валидный id_token для тестов
    await initFixtures();

    // Создаём тестовый модуль NestJS с реальными RedisService и SessionService,
    // но с замоканным KeycloakClient
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        SessionService,
        AuthService,
        {
          provide: KeycloakClient,
          useValue: {
            exchangeCode: jest.fn(),
            refreshTokens: jest.fn(),
            revokeRefreshToken: jest.fn(),
          },
        },
      ],
    }).compile();

    redisService = moduleRef.get(RedisService);
    sessionService = moduleRef.get(SessionService);
    authService = moduleRef.get(AuthService);
    keycloakClientMock = moduleRef.get(KeycloakClient) as jest.Mocked<KeycloakClient>;

    // Подключаемся к реальному Redis
    await redisService.onModuleInit();
  });

  afterAll(async () => {
    // Закрываем соединение с Redis
    await redisService.onModuleDestroy();
  });

  beforeEach(async () => {
    // Очищаем все ключи в Redis перед каждым тестом
    await redisService.client.flushAll();
    // Сбрасываем вызовы моков
    jest.clearAllMocks();
  });

  describe('buildAuthorizationUrl / Генерация URL авторизации', () => {
    it('generates PKCE pair and saves verifier in Redis by state key / генерирует PKCE-пару и сохраняет verifier в Redis по ключу state', async () => {
      // Вызываем метод генерации URL авторизации
      const url = await authService.buildAuthorizationUrl();
      const parsed = new URL(url);

      // Проверяем URL авторизации
      expect(parsed.pathname).toContain('/protocol/openid-connect/auth');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('client_id')).toBe('bff-client');

      // Извлекаем state и code_challenge
      const state = parsed.searchParams.get('state');
      expect(state).toBeTruthy();
      const codeChallenge = parsed.searchParams.get('code_challenge');
      expect(codeChallenge).toBeTruthy();

      // Проверяем, что verifier сохранён в Redis по ключу state
      const verifier = await redisService.getOAuthState(state!);
      expect(verifier).toBeTruthy();

      // Проверяем соответствие code_challenge и verifier (S256)
      const expectedChallenge = crypto.createHash('sha256').update(verifier!).digest('base64url');
      expect(codeChallenge).toBe(expectedChallenge);
    });
  });

  describe('exchangeCode / Обмен кода на токены', () => {
    it('exchanges code for tokens, creates session in Redis, and deletes state / обменивает code на токены, создаёт сессию в Redis и удаляет state', async () => {
      // Подготавливаем state и verifier в Redis
      const state = 'test-state';
      const verifier = 'test-verifier';
      await redisService.setOAuthState(state, verifier);

      // Мок KeycloakClient.exchangeCode возвращает фиктивные токены
      keycloakClientMock.exchangeCode.mockResolvedValue(validTokenSet);

      // Вызываем обмен кода
      const session = await authService.exchangeCode('test-code', state);

      // Проверяем, что state удалён из Redis (one-time use)
      const storedVerifier = await redisService.getOAuthState(state);
      expect(storedVerifier).toBeNull();

      // Проверяем, что сессия создана и содержит правильные данные
      const storedSession = await sessionService.get(session.id);
      expect(storedSession).toBeDefined();
      expect(storedSession!.user.id).toBe(idTokenPayload.sub);
      expect(storedSession!.tokens.accessToken).toBe(validTokenSet.access_token);
      expect(storedSession!.csrfToken).toBeDefined();

      // Убеждаемся, что KeycloakClient.exchangeCode вызван с правильным verifier
      expect(keycloakClientMock.exchangeCode).toHaveBeenCalledWith('test-code', verifier);
    });

    it('throws BadRequestException when state is not found in Redis / бросает BadRequestException, если state не найден в Redis', async () => {
      // state отсутствует в Redis — должна быть ошибка
      await expect(authService.exchangeCode('code', 'nonexistent')).rejects.toThrow('Invalid or expired OAuth state');
    });
  });

  describe('refreshTokens / Обновление токенов', () => {
    it('updates tokens in session and saves them to Redis / обновляет токены в сессии и сохраняет их в Redis', async () => {
      // Создаём сессию в Redis
      const session = await sessionService.create(idTokenPayload, validTokenSet, idTokenPayload.sub);
      // Мок KeycloakClient.refreshTokens возвращает новые токены
      keycloakClientMock.refreshTokens.mockResolvedValue(refreshedTokenSet);

      // Вызываем обновление токенов
      const newTokens = await authService.refreshTokens(session.id, session.tokens);

      // Проверяем возвращённые токены
      expect(newTokens.accessToken).toBe(refreshedTokenSet.access_token);
      // Проверяем, что сессия в Redis обновлена
      const updatedSession = await sessionService.get(session.id);
      expect(updatedSession!.tokens.accessToken).toBe(refreshedTokenSet.access_token);
      // Убеждаемся, что refreshTokens вызван со старым refresh token
      expect(keycloakClientMock.refreshTokens).toHaveBeenCalledWith(validTokenSet.refresh_token);
    });
  });

  describe('logout / Выход из системы', () => {
    it('deletes session, revokes refresh token, and returns Keycloak logout URL / удаляет сессию, отзывает refresh token и возвращает URL выхода из Keycloak', async () => {
      // Создаём сессию
      const session = await sessionService.create(idTokenPayload, validTokenSet, idTokenPayload.sub);
      // Мок revokeRefreshToken успешен
      keycloakClientMock.revokeRefreshToken.mockResolvedValue(undefined);

      // Вызываем logout
      const logoutUrl = await authService.logout(session);

      // Сессия должна быть удалена из Redis
      const storedSession = await sessionService.get(session.id);
      expect(storedSession).toBeNull();
      // revokeRefreshToken должен быть вызван с refresh token
      expect(keycloakClientMock.revokeRefreshToken).toHaveBeenCalledWith(validTokenSet.refresh_token);
      // Проверяем URL выхода из Keycloak
      expect(logoutUrl).toContain('protocol/openid-connect/logout');
      expect(logoutUrl).toContain('id_token_hint=' + validTokenSet.id_token);
    });
  });
});
