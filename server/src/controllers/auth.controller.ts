import { Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from '@services/auth.service';
import { SessionService } from '@services/session.service';
import { SessionGuard } from '@guards/session.guard';

@Controller()
export class AuthController {
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

      res.redirect('http://localhost:8081/');
    } catch (e) {
      console.error('Callback error:', e.message, e.stack);
      res.redirect('http://localhost:8081/login?error=auth_failed');
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
  @UseGuards(SessionGuard)
  async logout(@Req() req: any, @Res() res: Response) {
    const sessionId = req.cookies?.SESSION_ID;
    const session = req.userSession;

    if (sessionId) {
      await this.sessionService.deleteSession(sessionId);
    }

    res.clearCookie('SESSION_ID', { path: '/' });

    // Завершаем сессию Keycloak и возвращаемся на главную
    const logoutUrl = `http://localhost:8080/realms/TestRealm/protocol/openid-connect/logout?id_token_hint=${session.idToken}&post_logout_redirect_uri=http://localhost:8081/`;
    res.redirect(logoutUrl);
  }
}