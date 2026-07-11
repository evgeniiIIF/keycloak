import { Controller, Post, Req, Res, Header } from '@nestjs/common';
import { Request, Response } from 'express';
import { jwtVerify } from 'jose';
import { config } from '../config/config';
import { JwksService } from '../services/jwks.service';
import { RedisService } from '../services/redis.service';
import { AuthService } from '../services/auth.service';
import { Logger } from '../shared/logger';
import { errorMessage } from '../shared/utils';
import { Public } from '../decorators/auth.decorator';

@Public()
@Controller()
export class BackchannelController {
  constructor(
    private jwksService: JwksService,
    private redisService: RedisService,
    private authService: AuthService,
  ) {}

  @Post('api/auth/backchannel-logout')
  @Header('Cache-Control', 'no-store')
  async backchannelLogout(@Req() req: Request, @Res() res: Response) {
    const logoutToken = req.body?.logout_token;
    if (!logoutToken) {
      res.status(400).send('Missing logout_token');
      return;
    }

    try {
      const { payload } = await jwtVerify(logoutToken, this.jwksService.getJWKS(), {
        issuer: config.keycloak.publicIssuer,
        audience: config.keycloak.clientId,
      });

      const events = payload.events as Record<string, unknown> | undefined;
      if (!events?.['http://schemas.openid.net/event/backchannel-logout']) {
        res.status(400).send('Missing backchannel-logout event');
        return;
      }

      const jti = payload.jti;
      if (jti) {
        const key = `replay:${jti}`;
        const exists = await this.redisService.client.exists(key);
        if (exists) {
          Logger.warn('Auth', 'Backchannel logout replay', { jti });
          res.status(401).send('Replay detected');
          return;
        }
        const exp = payload.exp || Math.floor(Date.now() / 1000) + 300;
        const ttl = Math.max(exp - Math.floor(Date.now() / 1000) + 300, 60);
        await this.redisService.client.set(key, '1', { EX: ttl });
      }

      if (!payload.sub) {
        res.status(400).send('Missing sub claim');
        return;
      }

      Logger.info('Auth', 'Backchannel logout', { sub: payload.sub });
      await this.authService.destroyUserSessions(payload.sub);
      res.status(200).send('OK');
    } catch (err: unknown) {
      Logger.error('Auth', `Backchannel logout failed: ${errorMessage(err)}`);
      res.status(401).send('Invalid logout token');
    }
  }
}
