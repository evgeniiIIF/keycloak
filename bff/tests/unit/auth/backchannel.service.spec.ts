import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TEST_JWT_AUDIENCE, TEST_JWT_ISSUER, TEST_JWT_KEY } from '@tests/shared/fixtures/jwt-keys';
import { SignJWT } from 'jose';

import { RedisClient } from '@/infra/redis/redis.client';
import { BackchannelService } from '@/modules/auth/services/backchannel.service';
import { JwksService } from '@/modules/auth/services/jwks.service';
import { SessionService } from '@/modules/sessions/services/session.service';

const BACKCHANNEL_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

describe('BackchannelService (unit)', () => {
  let backchannel: BackchannelService;
  let redis: { exists: jest.Mock; set: jest.Mock };
  let sessionService: jest.Mocked<SessionService>;

  beforeEach(async () => {
    redis = { exists: jest.fn(), set: jest.fn() };

    sessionService = {
      destroyAllSessions: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    const jwks = {
      getJWKS: jest.fn().mockReturnValue(TEST_JWT_KEY),
    } as unknown as jest.Mocked<JwksService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BackchannelService,
        { provide: RedisClient, useValue: redis },
        { provide: SessionService, useValue: sessionService },
        { provide: JwksService, useValue: jwks },
      ],
    }).compile();

    backchannel = moduleRef.get(BackchannelService);
  });

  describe('handleBackchannelLogout', () => {
    it('верифицирует токен, помечает jti и удаляет сессии пользователя', async () => {
      const token = await signLogoutToken({ sub: 'user-123', jti: 'jti-1' });
      redis.exists.mockResolvedValue(false);
      redis.set.mockResolvedValue(undefined);

      await backchannel.handleBackchannelLogout(token);

      expect(redis.exists).toHaveBeenCalledWith('replay:jti-1');
      expect(redis.set).toHaveBeenCalledWith('replay:jti-1', '1', expect.any(Number));
      expect(sessionService.destroyAllSessions).toHaveBeenCalledWith('user-123');
    });

    it('бросает UnauthorizedException при replay', async () => {
      const token = await signLogoutToken({ sub: 'user-123', jti: 'jti-1' });
      redis.exists.mockResolvedValue(true);

      await expect(backchannel.handleBackchannelLogout(token))
        .rejects.toThrow(UnauthorizedException);
    });

    it('бросает BadRequestException, если в токене нет sub', async () => {
      const token = await signLogoutToken({ jti: 'jti-1' });
      redis.exists.mockResolvedValue(false);

      await expect(backchannel.handleBackchannelLogout(token))
        .rejects.toThrow(BadRequestException);
    });

    it('бросает UnauthorizedException, если нет backchannel-события', async () => {
      const token = await signLogoutToken({ sub: 'user-123' }, { includeEvent: false });

      await expect(backchannel.handleBackchannelLogout(token))
        .rejects.toThrow(UnauthorizedException);
    });

    it('бросает UnauthorizedException на токен с неправильным issuer', async () => {
      const token = await signLogoutToken({ sub: 'user-123' }, { issuer: 'http://evil' });

      await expect(backchannel.handleBackchannelLogout(token))
        .rejects.toThrow(UnauthorizedException);
    });

    it('работает без jti — replay-защита пропускается', async () => {
      const token = await signLogoutToken({ sub: 'user-123' });

      await backchannel.handleBackchannelLogout(token);

      expect(redis.exists).not.toHaveBeenCalled();
      expect(sessionService.destroyAllSessions).toHaveBeenCalledWith('user-123');
    });
  });
});

interface LogoutTokenClaims { sub?: string; jti?: string; }
interface SignOptions { includeEvent?: boolean; issuer?: string; }

async function signLogoutToken(claims: LogoutTokenClaims, options: SignOptions = {}): Promise<string> {
  const { includeEvent = true, issuer = TEST_JWT_ISSUER } = options;

  const payload: Record<string, unknown> = {};
  if (claims.sub) payload.sub = claims.sub;
  if (claims.jti) payload.jti = claims.jti;
  if (includeEvent) payload.events = { [BACKCHANNEL_EVENT]: {} };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(issuer)
    .setAudience(TEST_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(TEST_JWT_KEY);
}
