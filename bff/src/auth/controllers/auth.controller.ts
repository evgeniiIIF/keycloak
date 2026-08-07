import { Controller, Get, Post, Query, Res, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from '../services/auth.service';
import { Public, AuthSession } from '../decorators/auth.decorator';
import { OAuthCallbackInterceptor } from '../interceptors/oauth-callback.interceptor';
import { OAuthCallbackDto } from '../dto/oauth-callback.dto';
import { config } from '../../config/config';
import { Logger } from '../../shared/logger/logger';
import { Session } from '../../types/session';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('login')
  async login(@Res() res: Response) {
    const url = await this.authService.buildAuthorizationUrl();
    res.redirect(url);
  }

  @Public()
  @Get('callback')
  @UseInterceptors(OAuthCallbackInterceptor)
  async callback(@Query() query: OAuthCallbackDto, @Res() res: Response) {
    try {
      const sessionId = await this.authService.exchangeCode(query.code, query.state);
      res.cookie(config.session.cookieName, sessionId, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        maxAge: config.session.ttl * 1000,
        path: '/',
      });
      res.redirect(`${config.frontendUrl}/`);
    } catch (err) {
      Logger.error('AuthController', 'Callback failed', { error: (err as Error).message });
      res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
    }
  }

  @Get('api/me')
  me(@AuthSession() session: Session) {
    return { user: session.user };
  }

  @Post('logout')
  async logout(@AuthSession() session: Session, @Res() res: Response) {
    const logoutUrl = await this.authService.logout(session);

    res.clearCookie(config.session.cookieName, {
      path: '/',
      sameSite: 'lax',
      secure: config.isProduction,
    });
    res.clearCookie('XSRF-TOKEN', { path: '/' });
    res.json({ logoutUrl });
  }
}
