import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { BackchannelService } from '../backchannel.service';
import { JwksService } from '../jwks.service';
import { RedisService } from '../../../redis/services/redis.service';
import { SessionService } from '../../../session/services/session.service';

interface MockPayload {
  sub?: string;
  jti?: string;
  events?: Record<string, unknown>;
}

describe('BackchannelService (unit)', () => {
  let backchannelService: BackchannelService;
  let jwksServiceMock: jest.Mocked<JwksService>;
  let redisServiceMock: jest.Mocked<RedisService>;
  let sessionServiceMock: jest.Mocked<SessionService>;

  // Простые моки для Redis client
  const existsMock = jest.fn();
  const setMock = jest.fn();

  beforeEach(async () => {
    jwksServiceMock = {
      getJWKS: jest.fn().mockReturnValue(jest.fn()),
    } as unknown as jest.Mocked<JwksService>;

    redisServiceMock = {
      client: {
        exists: existsMock,
        set: setMock,
      },
    } as unknown as jest.Mocked<RedisService>;

    sessionServiceMock = {
      destroyAllSessions: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BackchannelService,
        { provide: JwksService, useValue: jwksServiceMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: SessionService, useValue: sessionServiceMock },
      ],
    }).compile();

    backchannelService = moduleRef.get(BackchannelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleBackchannelLogout', () => {
    it('успешно обрабатывает logout token и удаляет сессии пользователя', async () => {
      const mockPayload: MockPayload = {
        sub: 'user-123',
        jti: 'jti-123',
        events: {
          'http://schemas.openid.net/event/backchannel-logout': {},
        },
      };

      (backchannelService as unknown as { verifyLogoutToken: jest.Mock }).verifyLogoutToken = jest.fn().mockResolvedValue(mockPayload);

      existsMock.mockResolvedValue(0);
      setMock.mockResolvedValue('OK');

      await backchannelService.handleBackchannelLogout('logout-token');

      expect(existsMock).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalled();
      expect(sessionServiceMock.destroyAllSessions).toHaveBeenCalledWith('user-123');
    });

    it('бросает UnauthorizedException при replay-атаке', async () => {
      const mockPayload: MockPayload = {
        sub: 'user-123',
        jti: 'jti-123',
        events: {
          'http://schemas.openid.net/event/backchannel-logout': {},
        },
      };

      (backchannelService as unknown as { verifyLogoutToken: jest.Mock }).verifyLogoutToken = jest.fn().mockResolvedValue(mockPayload);

      existsMock.mockResolvedValue(1);

      await expect(backchannelService.handleBackchannelLogout('logout-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('бросает BadRequestException если отсутствует sub', async () => {
      const mockPayload: MockPayload = {
        jti: 'jti-123',
        events: {
          'http://schemas.openid.net/event/backchannel-logout': {},
        },
      };

      (backchannelService as unknown as { verifyLogoutToken: jest.Mock }).verifyLogoutToken = jest.fn().mockResolvedValue(mockPayload);

      existsMock.mockResolvedValue(0);

      await expect(backchannelService.handleBackchannelLogout('logout-token'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('checkReplay', () => {
    it('не бросает ошибку, если jti не найден', async () => {
      existsMock.mockResolvedValue(0);
      setMock.mockResolvedValue('OK');

      await (backchannelService as unknown as { checkReplay: jest.Mock }).checkReplay('jti-123');

      expect(setMock).toHaveBeenCalledWith(
        'replay:jti-123',
        '1',
        { EX: 300 },
      );
    });

    it('бросает UnauthorizedException, если jti уже существует', async () => {
      existsMock.mockResolvedValue(1);

      await expect((backchannelService as unknown as { checkReplay: jest.Mock }).checkReplay('jti-123'))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
