import { BackchannelController } from './backchannel.controller';
import { jwtVerify } from 'jose';

jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
}));

function createMockReq(body: Record<string, unknown> = {}) {
  return { body } as any;
}

function createMockRes() {
  const res: any = {
    _status: undefined as number | undefined,
    _body: undefined as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    send(body: unknown) {
      res._body = body;
      return res;
    },
  };
  return res;
}

describe('BackchannelController', () => {
  let controller: BackchannelController;
  let jwksService: any;
  let redisService: any;
  let authService: any;

  beforeEach(() => {
    jwksService = { getJWKS: jest.fn() };
    redisService = {
      client: {
        exists: jest.fn().mockResolvedValue(0),
        set: jest.fn().mockResolvedValue('OK'),
      },
    };
    authService = { destroyUserSessions: jest.fn().mockResolvedValue(undefined) };
    controller = new BackchannelController(jwksService, redisService, authService);
    jest.clearAllMocks();
  });

  it('returns 400 if no logout_token', async () => {
    const req = createMockReq({});
    const res = createMockRes();
    await controller.backchannelLogout(req, res);
    expect(res._status).toBe(400);
    expect(res._body).toBe('Missing logout_token');
  });

  it('returns 400 if events claim is missing', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {
        sub: 'user-1',
        jti: 'jti-1',
        exp: Math.floor(Date.now() / 1000) + 300,
      },
    });

    const req = createMockReq({ logout_token: 'some-token' });
    const res = createMockRes();
    await controller.backchannelLogout(req, res);
    expect(res._status).toBe(400);
    expect(res._body).toBe('Missing backchannel-logout event');
  });

  it('returns 400 if sub claim is missing', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {
        jti: 'jti-1',
        exp: Math.floor(Date.now() / 1000) + 300,
        events: { 'http://schemas.openid.net/event/backchannel-logout': {} },
      },
    });

    const req = createMockReq({ logout_token: 'some-token' });
    const res = createMockRes();
    await controller.backchannelLogout(req, res);
    expect(res._status).toBe(400);
    expect(res._body).toBe('Missing sub claim');
  });

  it('returns 200 and destroys sessions on valid token', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {
        sub: 'user-1',
        jti: 'jti-1',
        exp: Math.floor(Date.now() / 1000) + 300,
        events: { 'http://schemas.openid.net/event/backchannel-logout': {} },
      },
    });

    const req = createMockReq({ logout_token: 'valid-token' });
    const res = createMockRes();
    await controller.backchannelLogout(req, res);
    expect(res._status).toBe(200);
    expect(authService.destroyUserSessions).toHaveBeenCalledWith('user-1');
  });

  it('detects replay via jti', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {
        sub: 'user-1',
        jti: 'jti-1',
        exp: Math.floor(Date.now() / 1000) + 300,
        events: { 'http://schemas.openid.net/event/backchannel-logout': {} },
      },
    });

    redisService.client.exists.mockResolvedValue(1);

    const req = createMockReq({ logout_token: 'replayed-token' });
    const res = createMockRes();
    await controller.backchannelLogout(req, res);
    expect(res._status).toBe(401);
    expect(res._body).toBe('Replay detected');
  });
});
