import { Controller, Get, Post, Query, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from '@services/auth.service';
import { SessionService } from '@services/session.service';
import { SessionGuard } from '@guards/session.guard';
import { config } from '@configs/configuration';

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
  ) {}

  @Get('login')
  async login(@Res() res: Response) {
    const { url } = await this.authService.getAuthorizationUrl();
    res.redirect(url);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const session = await this.authService.handleCallback(code, state);

      res.cookie('SESSION_ID', session.sessionId, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
      });

      res.redirect(config.frontendUrl + '/');
    } catch (e) {
      this.logger.error(`Callback error: ${e.message}`, e.stack);
      res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
    }
  }

  @Get('api/me')
  @UseGuards(SessionGuard)
  async me(@Req() req: any) {
    const session = req.userSession;
    return {
      user: session.userInfo,
      csrfToken: session.csrfToken,
    };
  }

  // Новый GET /logout вместо POST
  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.cookies?.SESSION_ID;
    let idToken: string | undefined;

    if (sessionId) {
      const session = await this.sessionService.getSession(sessionId);
      if (session) {
        idToken = session.idToken;
        await this.sessionService.deleteSession(sessionId);
      }
    }

    res.clearCookie('SESSION_ID', { path: '/' });

    // Завершаем сессию Keycloak. Если idToken нет, Keycloak все равно предложит выбрать сессию для выхода или выйдет из текущей.
    const logoutUrl = this.authService.getLogoutUrl(idToken || '');
    res.redirect(logoutUrl);
  }
}