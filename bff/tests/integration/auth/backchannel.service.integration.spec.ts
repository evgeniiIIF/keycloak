import { Test, TestingModule } from '@nestjs/testing';
import { TEST_JWT_KEY } from '@tests/shared/fixtures/jwt-keys';
import { SignJWT } from 'jose';

import { config } from '@/config/config';
import { RedisClient } from '@/infra/redis/redis.client';
import { BackchannelService } from '@/modules/auth/services/backchannel.service';
import { JwksService } from '@/modules/auth/services/jwks.service';
import { SessionRepository } from '@/modules/sessions/repositories/session.repository';
import { UserSessionsRepository } from '@/modules/sessions/repositories/user-sessions.repository';
import { SessionService } from '@/modules/sessions/services/session.service';

const BACKCHANNEL_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

describe('BackchannelService (integration, real Redis)', () => {
  let redis: RedisClient;
  let backchannel: BackchannelService;
  let sessionService: SessionService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RedisClient,
        SessionRepository,
        UserSessionsRepository,
        SessionService,
        BackchannelService,
        { provide: JwksService, useValue: { getJWKS: () => TEST_JWT_KEY } },
      ],
    }).compile();

    redis = moduleRef.get(RedisClient);
    sessionService = moduleRef.get(SessionService);
    backchannel = moduleRef.get(BackchannelService);

    await redis.onModuleInit();
  });

  afterAll(async () => {
    await redis.onModuleDestroy();
  });

  beforeEach(async () => {
    await redis.flushAll();
  });

  it('replay-защита работает с реальным Redis', async () => {
    const token = await signLogoutToken({ sub: 'user-1', jti: 'jti-integration-1' });

    await backchannel.handleBackchannelLogout(token);

    expect(await redis.exists('replay:jti-integration-1')).toBe(true);

    await expect(backchannel.handleBackchannelLogout(token))
      .rejects.toThrow('Replay detected');
  });

  it('destroyAllSessions удаляет все сессии пользователя', async () => {
    const payload = {
      sub: 'integration-user-1',
      email: 'test@example.com',
      preferred_username: 'testuser',
      name: 'Test User',
      realm_access: { roles: ['user'] },
      resource_access: {},
    };
    const tokens = { access_token: 'a', refresh_token: 'r', id_token: 'i' };

    const s1 = await sessionService.create(payload, tokens, payload.sub);
    const s2 = await sessionService.create(payload, tokens, payload.sub);

    expect(await sessionService.get(s1.id)).toBeDefined();
    expect(await sessionService.get(s2.id)).toBeDefined();

    await sessionService.destroyAllSessions(payload.sub);

    expect(await sessionService.get(s1.id)).toBeNull();
    expect(await sessionService.get(s2.id)).toBeNull();
  });
});

// Подписываем logout token тем же issuer/audience, который проверяет BackchannelService.
// В integration issuer приходит от testcontainers (localhost:<mapped>), а не из .env.
async function signLogoutToken(claims: { sub?: string; jti?: string }): Promise<string> {
  const payload: Record<string, unknown> = { events: { [BACKCHANNEL_EVENT]: {} } };
  if (claims.sub) payload.sub = claims.sub;
  if (claims.jti) payload.jti = claims.jti;

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(config.keycloak.publicIssuer)
    .setAudience(config.keycloak.clientId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(TEST_JWT_KEY);
}
