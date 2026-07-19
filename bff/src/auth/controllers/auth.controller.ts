import { Controller, Get, Post, Query, Req, Res, UseGuards, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { OAuthCallbackInterceptor } from '../interceptors/oauth-callback.interceptor';
import { OAuthCallbackDto } from '../dto/oauth-callback.dto';
import { config } from '../../config/config';
import { AuthGuard } from '../guards/auth.guard';
import type { AuthSession } from '../../types/session';

@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('login')
  async login(@Res() res: Response) {
    const authorizationUrl = this.authService.buildAuthorizationUrl();
    res.redirect(authorizationUrl);
  }

  @Get('callback')
  @UseInterceptors(OAuthCallbackInterceptor)
  async callback(
    @Query(new ValidationPipe({ transform: true })) query: OAuthCallbackDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.authService.handleOAuthCallback(
      query.code,
      query.state,
      req.session as AuthSession,
    );
    res.redirect(redirectUrl);
  }

  @Get('api/me')
  @UseGuards(AuthGuard)
  me(@Req() req: Request) {
    return { user: req.session.userInfo };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Req() req: Request, @Res() res: Response) {
    const logoutUrl = await this.authService.performLogout(req.session as AuthSession);

    res.clearCookie(config.session.cookieName, {
      path: '/',
      sameSite: 'lax',
      secure: config.isProduction,
    });
    res.clearCookie('XSRF-TOKEN', { path: '/' });
    res.json({ logoutUrl });
  }
}
