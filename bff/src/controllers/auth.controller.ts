import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { KeycloakClient } from '../services/keycloak-client';
import { config } from '../config/config';
import { CallbackQueryDto } from '../dto/callback.dto';
import { Logger } from '../shared/logger';
import { errorMessage } from '../shared/utils';
import { Public, RequireSession, RequireCsrf } from '../decorators/auth.decorator';

const SESSION_COOKIE_NAME = 'connect.sid';

@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
    private keycloak: KeycloakClient,
  ) {}

  @Public()
  @Get('login')
  async login(@Req() req: Request, @Res() res: Response) {
    const url = this.authService.buildAuthorizationUrl(req.session);
    res.redirect(url);
  }

  @Public()
  @Get('callback')
  async callback(@Query() query: CallbackQueryDto, @Req() req: Request, @Res() res: Response) {
    const { session } = req;

    if (query.error) {
      Logger.warn('Auth', `OAuth error: ${query.error}`);
      res.redirect(`${config.frontendUrl}/login?error=${query.error}`);
      return;
    }

    if (!query.code || !query.state) {
      res.redirect(`${config.frontendUrl}/login?error=missing_params`);
      return;
    }

    try {
      const oldCsrf = session.csrfToken;

      await new Promise<void>((resolve, reject) => {
        session.regenerate((err: Error | null) => (err ? reject(err) : resolve()));
      });

      if (oldCsrf) session.csrfToken = oldCsrf;

      await this.authService.handleCallback(query.code, query.state, session);

      session.save((err: Error | null) => {
        if (err) {
          Logger.error('Auth', `Session save: ${err.message}`);
          res.redirect(`${config.frontendUrl}/login?error=session_save_failed`);
          return;
        }
        Logger.info('Auth', 'Login complete', {
          user: session.userInfo?.preferred_username || session.userInfo?.email || '?',
        });
        res.redirect(`${config.frontendUrl}/`);
      });
    } catch (err: unknown) {
      Logger.error('Auth', `Callback error: ${errorMessage(err)}`);
      res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
    }
  }

  @RequireSession()
  @Get('api/me')
  me(@Req() req: Request) {
    return { user: req.session.userInfo };
  }

  @RequireSession()
  @RequireCsrf()
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const { session } = req;
    const { idToken, refreshToken, userInfo } = session;
    const userId = userInfo?.sub;

    if (refreshToken) {
      await this.keycloak.revokeRefreshToken(refreshToken);
    }

    if (userId && session.id) {
      await this.authService.unregisterSession(userId, session.id).catch((err: unknown) => {
        Logger.warn('Auth', `Unregister session failed: ${errorMessage(err)}`);
      });
    }

    session.destroy((err: Error | null) => {
      if (err) Logger.error('Auth', `Session destroy: ${err.message}`);
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.clearCookie('XSRF-TOKEN', { path: '/' });
      const logoutUrl = idToken ? this.authService.getLogoutUrl(idToken) : '/login';
      res.json({ logoutUrl });
    });
  }
}
